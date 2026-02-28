package com.kakeibo.backend.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import javax.sql.DataSource

object DatabaseConfig {
    private lateinit var dataSource: HikariDataSource

    fun init(environment: ApplicationEnvironment) {
        val dbConfig = environment.config.config("database")
        val url = dbConfig.property("url").getString()
        val user = dbConfig.property("user").getString()
        val password = dbConfig.property("password").getString()
        val maxPoolSize = dbConfig.property("maxPoolSize").getString().toInt()

        val hikariConfig = HikariConfig().apply {
            jdbcUrl = url
            driverClassName = "org.postgresql.Driver"
            username = user
            this.password = password
            maximumPoolSize = maxPoolSize
            minimumIdle = 2
            idleTimeout = 600_000 // 10 minutes
            connectionTimeout = 30_000 // 30 seconds
            maxLifetime = 1_800_000 // 30 minutes
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_READ_COMMITTED"
            validate()
        }

        dataSource = HikariDataSource(hikariConfig)

        // Run Flyway migrations
        runMigrations(dataSource)

        // Connect Exposed
        Database.connect(dataSource)
    }

    fun getDataSource(): DataSource = dataSource

    private fun runMigrations(dataSource: DataSource) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load()
            .migrate()
    }

    fun close() {
        if (::dataSource.isInitialized) {
            dataSource.close()
        }
    }
}
