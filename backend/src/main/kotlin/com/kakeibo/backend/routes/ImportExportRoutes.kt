package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.FileTooLargeException
import com.kakeibo.backend.middleware.InvalidRequestException
import com.kakeibo.backend.service.ImportExportService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.*
import com.kakeibo.shared.validation.ValidationRules
import kotlinx.serialization.json.Json
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * マルチパートのファイルパートを上限サイズを守りながらストリーミング読み込みする。
 * 上限を超えた時点で即座に例外を投げ、メモリへの全量バッファリングを防ぐ。
 */
private suspend fun PartData.FileItem.readAllWithLimit(maxBytes: Long): ByteArray {
    val channel = provider()
    val buffer = ByteArrayOutputStream()
    val chunk = ByteArray(8 * 1024)
    var total = 0L
    while (true) {
        val read = channel.readAvailable(chunk, 0, chunk.size)
        if (read <= 0) break
        total += read
        if (total > maxBytes) {
            throw FileTooLargeException("ファイルサイズが上限(${maxBytes / (1024 * 1024)}MB)を超えています")
        }
        buffer.write(chunk, 0, read)
    }
    return buffer.toByteArray()
}

fun Route.importExportRoutes(importExportService: ImportExportService) {
  rateLimit(RateLimitName("import-export")) {
    route("/import") {
        post("/csv/preview") {
            val multipart = call.receiveMultipart()
            var fileBytes: ByteArray? = null

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        fileBytes = part.readAllWithLimit(ValidationRules.MAX_IMPORT_FILE_SIZE.toLong())
                    }
                    else -> {}
                }
                part.dispose()
            }

            val bytes = fileBytes
                ?: throw InvalidRequestException("ファイルがアップロードされていません")

            val response = importExportService.previewCsvImport(ByteArrayInputStream(bytes), bytes.size.toLong())
            call.respond(HttpStatusCode.OK, response)
        }

        post("/csv") {
            val multipart = call.receiveMultipart()
            var fileBytes: ByteArray? = null

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        fileBytes = part.readAllWithLimit(ValidationRules.MAX_IMPORT_FILE_SIZE.toLong())
                    }
                    else -> {}
                }
                part.dispose()
            }

            val bytes = fileBytes
                ?: throw InvalidRequestException("ファイルがアップロードされていません")

            val response = importExportService.importCsv(ByteArrayInputStream(bytes), bytes.size.toLong())
            call.respond(HttpStatusCode.OK, response)
        }
    }

    route("/export") {
        get("/csv") {
            val dateFrom = call.request.queryParameters["date_from"]
            val dateTo = call.request.queryParameters["date_to"]
            val csvBytes = importExportService.exportCsv(dateFrom, dateTo)
            call.response.header(
                HttpHeaders.ContentDisposition,
                "attachment; filename=\"transactions.csv\""
            )
            call.respondBytes(csvBytes, ContentType.Text.CSV)
        }

        get("/pdf") {
            val type = call.request.queryParameters["type"] ?: "monthly"
            val yearMonth = call.request.queryParameters["year_month"]
            val year = call.request.queryParameters["year"]?.toIntOrNull()
            val pdfBytes = importExportService.generatePdf(type, yearMonth, year)
            call.response.header(
                HttpHeaders.ContentDisposition,
                "attachment; filename=\"report.pdf\""
            )
            call.respondBytes(pdfBytes, ContentType.Application.Pdf)
        }
    }

    route("/backup") {
        get {
            val backupData = importExportService.createBackup()
            val jsonBytes = Json.encodeToString(
                com.kakeibo.shared.model.BackupData.serializer(),
                backupData
            ).toByteArray(Charsets.UTF_8)
            call.response.header(
                HttpHeaders.ContentDisposition,
                "attachment; filename=\"kakeibo_backup.json\""
            )
            call.respondBytes(jsonBytes, ContentType.Application.Json)
        }

        post("/restore") {
            val multipart = call.receiveMultipart()
            var fileBytes: ByteArray? = null
            var mode = "overwrite"

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        fileBytes = part.readAllWithLimit(ValidationRules.MAX_BACKUP_FILE_SIZE)
                    }
                    is PartData.FormItem -> {
                        if (part.name == "mode") {
                            mode = part.value
                        }
                    }
                    else -> {}
                }
                part.dispose()
            }

            val bytes = fileBytes
                ?: throw InvalidRequestException("ファイルがアップロードされていません")

            if (mode !in listOf("overwrite", "merge")) {
                throw InvalidRequestException("復元モードは 'overwrite' または 'merge' を指定してください")
            }

            val jsonText = bytes.toString(Charsets.UTF_8)
            val backupData = Json.decodeFromString(com.kakeibo.shared.model.BackupData.serializer(), jsonText)
            val errors = importExportService.restoreBackup(backupData, mode)
            val message = if (errors.isEmpty()) {
                "バックアップからの復元が完了しました"
            } else {
                "バックアップからの復元が完了しました（${errors.size}件の変換警告あり）"
            }
            call.respond(HttpStatusCode.OK, mapOf("message" to message, "warnings" to errors))
        }
    }
  }
}
