package com.kakeibo.backend.service

import com.kakeibo.backend.config.JwtConfig
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.RefreshTokenRepository
import com.kakeibo.backend.repository.UserRepository
import com.kakeibo.shared.constants.AppConstants
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.transactions.transaction
import org.mindrot.jbcrypt.BCrypt
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

class AuthService(
    private val userRepository: UserRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val jwtConfig: JwtConfig
) {
    companion object {
        // ユーザー名列挙のタイミング攻撃対策に使うダミーハッシュ。
        // findByUsername が null を返した経路でも本物の checkpw と同じ計算量を発生させる。
        // BCrypt 形式の固定値（このパスワードと一致することは絶対にないように "x" で
        // チェックしても false になる）。コスト因子は AppConstants.BCRYPT_COST_FACTOR
        // と揃え、本物のチェックと同等の計算量を保つ。
        private val DUMMY_BCRYPT_HASH: String =
            BCrypt.hashpw("dummy-password-for-timing-equalization", BCrypt.gensalt(AppConstants.BCRYPT_COST_FACTOR))
    }

    fun isSetupRequired(): Boolean {
        return userRepository.count() == 0L
    }

    fun setup(request: SetupRequest): SetupResponse {
        validateCredentials(request.username, request.password)

        val passwordHash = BCrypt.hashpw(request.password, BCrypt.gensalt(AppConstants.BCRYPT_COST_FACTOR))

        // count() チェックと create() の間で並行リクエストが両方 0 を観測する競合を避けるため、
        // 単一トランザクション内で再チェック → 作成を行う。
        // ユーザー名 UNIQUE 制約があるため別々のユーザー名で 2 件同時挿入は理論上可能だが、
        // 同時セットアップは認証前のレートリミットでも抑止する。
        val user = transaction {
            if (userRepository.count() > 0) {
                throw ConflictException("初期セットアップは既に完了しています")
            }
            userRepository.create(request.username.trim(), passwordHash)
        }

        return SetupResponse(
            user = UserResponse(user.id.toString(), user.username)
        )
    }

    fun login(request: LoginRequest): LoginResponse {
        val user = userRepository.findByUsername(request.username)

        if (user == null) {
            // ユーザー名列挙のタイミング攻撃対策として、ユーザーが存在しない場合でも
            // BCrypt 計算を実行し、認証応答時間を「正しいユーザー名」と同程度にする。
            BCrypt.checkpw(request.password, DUMMY_BCRYPT_HASH)
            throw UnauthorizedException("ユーザー名またはパスワードが正しくありません")
        }

        // Check if account is locked
        if (user.lockedUntil != null && user.lockedUntil.isAfter(OffsetDateTime.now())) {
            val remainingMinutes = ChronoUnit.MINUTES.between(OffsetDateTime.now(), user.lockedUntil) + 1
            throw AccountLockedException(
                "アカウントがロックされています。${remainingMinutes}分後に再試行してください",
                remainingMinutes
            )
        }

        if (!BCrypt.checkpw(request.password, user.passwordHash)) {
            // Increment failed attempts
            val attempts = userRepository.incrementFailedAttempts(user.id)
            
            // Lock account if max attempts reached
            if (attempts >= UserRepository.MAX_FAILED_ATTEMPTS) {
                val unlockAt = OffsetDateTime.now().plusMinutes(UserRepository.LOCK_DURATION_MINUTES)
                userRepository.lockAccount(user.id, unlockAt)
                throw AccountLockedException(
                    "ログイン試行回数が上限に達しました。${UserRepository.LOCK_DURATION_MINUTES}分後に再試行してください",
                    UserRepository.LOCK_DURATION_MINUTES
                )
            }
            
            throw UnauthorizedException("ユーザー名またはパスワードが正しくありません")
        }

        // Reset failed attempts on successful login
        userRepository.resetFailedAttempts(user.id)

        val accessToken = jwtConfig.generateAccessToken(user.id.toString(), user.username)
        val refreshToken = jwtConfig.generateRefreshToken()
        val tokenHash = RefreshTokenRepository.hashToken(refreshToken)
        val expiresAt = OffsetDateTime.now().plusDays(AppConstants.REFRESH_TOKEN_EXPIRY_DAYS)

        refreshTokenRepository.create(user.id, tokenHash, expiresAt)

        return LoginResponse(
            access_token = accessToken,
            refresh_token = refreshToken,
            expires_in = AppConstants.ACCESS_TOKEN_EXPIRY_SECONDS
        )
    }

    fun refresh(request: RefreshRequest): LoginResponse {
        val tokenHash = RefreshTokenRepository.hashToken(request.refresh_token)
        val tokenEntity = refreshTokenRepository.findByTokenHash(tokenHash)
            ?: throw UnauthorizedException("リフレッシュトークンが無効です", "TOKEN_REVOKED")

        if (tokenEntity.revokedAt != null) {
            throw UnauthorizedException("リフレッシュトークンが失効しています", "TOKEN_REVOKED")
        }

        if (tokenEntity.expiresAt.isBefore(OffsetDateTime.now())) {
            throw UnauthorizedException("リフレッシュトークンの有効期限が切れています", "TOKEN_EXPIRED")
        }

        val user = userRepository.findById(tokenEntity.userId)
            ?: throw UnauthorizedException("ユーザーが見つかりません")

        val accessToken = jwtConfig.generateAccessToken(user.id.toString(), user.username)
        val newRefreshToken = jwtConfig.generateRefreshToken()
        val newTokenHash = RefreshTokenRepository.hashToken(newRefreshToken)
        val expiresAt = OffsetDateTime.now().plusDays(AppConstants.REFRESH_TOKEN_EXPIRY_DAYS)

        // 同時実行リクエストによるリフレッシュトークン再利用を防ぐ:
        // `revokeIfActive` は WHERE revokedAt IS NULL の条件付き UPDATE を発行するため、
        // 並行する 2 つの refresh() 呼び出しのうち 1 つだけが 1 行更新できる。
        // 0 行だった側は「他リクエストが既にローテーションを完了した」と判断して拒否する。
        // 失効判定 (上の `revokedAt != null` チェック) は読み取り時点のスナップショットに過ぎず、
        // この条件付き UPDATE が真の TOCTOU ガードとして機能する。
        transaction {
            val revoked = refreshTokenRepository.revokeIfActive(tokenHash)
            if (revoked == 0) {
                throw UnauthorizedException("リフレッシュトークンが失効しています", "TOKEN_REVOKED")
            }
            refreshTokenRepository.create(user.id, newTokenHash, expiresAt)
        }

        return LoginResponse(
            access_token = accessToken,
            refresh_token = newRefreshToken,
            expires_in = AppConstants.ACCESS_TOKEN_EXPIRY_SECONDS
        )
    }

    fun logout(request: LogoutRequest) {
        val tokenHash = RefreshTokenRepository.hashToken(request.refresh_token)
        refreshTokenRepository.revoke(tokenHash)
    }

    fun changePassword(userId: String, request: PasswordChangeRequest) {
        val user = userRepository.findById(java.util.UUID.fromString(userId))
            ?: throw NotFoundException("ユーザーが見つかりません")

        if (!BCrypt.checkpw(request.current_password, user.passwordHash)) {
            throw ValidationException("現在のパスワードが正しくありません")
        }

        val errors = ValidationRules.validatePassword(request.new_password)
        if (errors.isNotEmpty()) {
            throw ValidationException("新しいパスワードの要件を満たしていません",
                errors.map { FieldError("new_password", it) })
        }

        val newHash = BCrypt.hashpw(request.new_password, BCrypt.gensalt(AppConstants.BCRYPT_COST_FACTOR))
        transaction {
            userRepository.updatePassword(user.id, newHash)
            refreshTokenRepository.revokeAllForUser(user.id)
        }
    }

    private fun validateCredentials(username: String, password: String) {
        val fieldErrors = mutableListOf<FieldError>()

        if (username.isBlank()) {
            fieldErrors.add(FieldError("username", "ユーザー名を入力してください"))
        }
        if (username.length > ValidationRules.USERNAME_MAX_LENGTH) {
            fieldErrors.add(FieldError("username", "ユーザー名は${ValidationRules.USERNAME_MAX_LENGTH}文字以下で入力してください"))
        }

        val passwordErrors = ValidationRules.validatePassword(password)
        fieldErrors.addAll(passwordErrors.map { FieldError("password", it) })

        if (fieldErrors.isNotEmpty()) {
            throw ValidationException("入力内容にエラーがあります", fieldErrors)
        }
    }
}
