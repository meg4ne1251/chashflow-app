package com.kakeibo.backend.service

import com.kakeibo.backend.config.JwtConfig
import com.kakeibo.backend.middleware.ConflictException
import com.kakeibo.backend.middleware.UnauthorizedException
import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.RefreshTokenEntity
import com.kakeibo.backend.repository.RefreshTokenRepository
import com.kakeibo.backend.repository.UserEntity
import com.kakeibo.backend.repository.UserRepository
import com.kakeibo.shared.model.*
import io.mockk.*
import org.mindrot.jbcrypt.BCrypt
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class AuthServiceTest {

    private lateinit var userRepository: UserRepository
    private lateinit var refreshTokenRepository: RefreshTokenRepository
    private lateinit var jwtConfig: JwtConfig
    private lateinit var authService: AuthService

    @BeforeTest
    fun setUp() {
        userRepository = mockk(relaxed = true)
        refreshTokenRepository = mockk(relaxed = true)
        jwtConfig = mockk(relaxed = true)
        authService = AuthService(userRepository, refreshTokenRepository, jwtConfig)
    }

    // ===========================
    // setup() tests
    // ===========================

    @Test
    fun `setup - should fail if user already exists`() {
        every { userRepository.count() } returns 1

        val exception = assertFailsWith<ConflictException> {
            authService.setup(SetupRequest("testuser", "Password1"))
        }
        assertEquals("初期セットアップは既に完了しています", exception.message)
    }

    @Test
    fun `setup - should fail with blank username`() {
        every { userRepository.count() } returns 0

        assertFailsWith<ValidationException> {
            authService.setup(SetupRequest("", "Password1"))
        }
    }

    @Test
    fun `setup - should fail with weak password`() {
        every { userRepository.count() } returns 0

        assertFailsWith<ValidationException> {
            authService.setup(SetupRequest("testuser", "weak"))
        }
    }

    @Test
    fun `setup - should succeed with valid credentials`() {
        every { userRepository.count() } returns 0
        every { userRepository.create(any(), any()) } returns UserEntity(
            id = UUID.randomUUID(),
            username = "testuser",
            passwordHash = "hash",
            createdAt = OffsetDateTime.now(),
            updatedAt = OffsetDateTime.now()
        )

        val result = authService.setup(SetupRequest("testuser", "Password1"))
        assertNotNull(result)
        assertEquals("testuser", result.user.username)

        verify { userRepository.create("testuser", any()) }
    }

    // ===========================
    // login() tests
    // ===========================

    @Test
    fun `login - should fail with invalid username`() {
        every { userRepository.findByUsername(any()) } returns null

        assertFailsWith<UnauthorizedException> {
            authService.login(LoginRequest("nonexistent", "Password1"))
        }
    }

    @Test
    fun `login - should fail with wrong password`() {
        val passwordHash = BCrypt.hashpw("CorrectPass1", BCrypt.gensalt(4))
        every { userRepository.findByUsername("testuser") } returns UserEntity(
            id = UUID.randomUUID(),
            username = "testuser",
            passwordHash = passwordHash,
            createdAt = OffsetDateTime.now(),
            updatedAt = OffsetDateTime.now()
        )

        assertFailsWith<UnauthorizedException> {
            authService.login(LoginRequest("testuser", "WrongPass1"))
        }
    }

    @Test
    fun `login - should succeed with valid credentials`() {
        val userId = UUID.randomUUID()
        val passwordHash = BCrypt.hashpw("Password1", BCrypt.gensalt(4))
        every { userRepository.findByUsername("testuser") } returns UserEntity(
            id = userId,
            username = "testuser",
            passwordHash = passwordHash,
            createdAt = OffsetDateTime.now(),
            updatedAt = OffsetDateTime.now()
        )
        every { jwtConfig.generateAccessToken(any(), any()) } returns "access-token"
        every { jwtConfig.generateRefreshToken() } returns "refresh-token"

        val result = authService.login(LoginRequest("testuser", "Password1"))

        assertEquals("access-token", result.access_token)
        assertEquals("refresh-token", result.refresh_token)
        verify { refreshTokenRepository.create(userId, any(), any()) }
    }

    // ===========================
    // refresh() tests
    // ===========================

    @Test
    fun `refresh - should fail with invalid token`() {
        every { refreshTokenRepository.findByTokenHash(any()) } returns null

        assertFailsWith<UnauthorizedException> {
            authService.refresh(RefreshRequest("invalid-token"))
        }
    }

    @Test
    fun `refresh - should fail with revoked token`() {
        every { refreshTokenRepository.findByTokenHash(any()) } returns RefreshTokenEntity(
            id = UUID.randomUUID(),
            userId = UUID.randomUUID(),
            tokenHash = "hash",
            expiresAt = OffsetDateTime.now().plusDays(1),
            createdAt = OffsetDateTime.now(),
            revokedAt = OffsetDateTime.now()
        )

        assertFailsWith<UnauthorizedException> {
            authService.refresh(RefreshRequest("revoked-token"))
        }
    }

    @Test
    fun `refresh - should fail with expired token`() {
        every { refreshTokenRepository.findByTokenHash(any()) } returns RefreshTokenEntity(
            id = UUID.randomUUID(),
            userId = UUID.randomUUID(),
            tokenHash = "hash",
            expiresAt = OffsetDateTime.now().minusDays(1),
            createdAt = OffsetDateTime.now(),
            revokedAt = null
        )

        assertFailsWith<UnauthorizedException> {
            authService.refresh(RefreshRequest("expired-token"))
        }
    }

    // ===========================
    // logout() tests
    // ===========================

    @Test
    fun `logout - should revoke refresh token`() {
        every { refreshTokenRepository.revoke(any()) } returns 1

        authService.logout(LogoutRequest("some-token"))

        verify { refreshTokenRepository.revoke(any()) }
    }
}
