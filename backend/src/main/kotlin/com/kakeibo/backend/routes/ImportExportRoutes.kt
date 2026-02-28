package com.kakeibo.backend.routes

import com.kakeibo.backend.service.ImportExportService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.*
import kotlinx.serialization.json.Json
import java.io.ByteArrayInputStream

fun Route.importExportRoutes(importExportService: ImportExportService) {
    route("/import") {
        post("/excel/preview") {
            val multipart = call.receiveMultipart()
            var fileBytes: ByteArray? = null

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        fileBytes = part.provider().toByteArray()
                    }
                    else -> {}
                }
                part.dispose()
            }

            val bytes = fileBytes
                ?: throw com.kakeibo.backend.middleware.InvalidRequestException("ファイルがアップロードされていません")

            val response = importExportService.previewExcelImport(ByteArrayInputStream(bytes), bytes.size.toLong())
            call.respond(HttpStatusCode.OK, response)
        }

        post("/excel") {
            val multipart = call.receiveMultipart()
            var fileBytes: ByteArray? = null

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        fileBytes = part.provider().toByteArray()
                    }
                    else -> {}
                }
                part.dispose()
            }

            val bytes = fileBytes
                ?: throw com.kakeibo.backend.middleware.InvalidRequestException("ファイルがアップロードされていません")

            val response = importExportService.importExcel(ByteArrayInputStream(bytes), bytes.size.toLong())
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
            val jsonText = call.receiveText()
            val backupData = Json.decodeFromString(com.kakeibo.shared.model.BackupData.serializer(), jsonText)
            importExportService.restoreBackup(backupData)
            call.respond(HttpStatusCode.OK, mapOf("message" to "バックアップからの復元が完了しました"))
        }
    }
}
