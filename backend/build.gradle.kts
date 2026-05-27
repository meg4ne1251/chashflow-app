val kotlinVersion: String by project
val ktorVersion: String by project
val exposedVersion: String by project
val flywayVersion: String by project
val hikariVersion: String by project
val postgresVersion: String by project
val serializationVersion: String by project
val logbackVersion: String by project
val jbcryptVersion: String by project
val javaJwtVersion: String by project
val micrometerVersion: String by project

plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    application
}

application {
    mainClass.set("com.kakeibo.backend.ApplicationKt")
}

dependencies {
    implementation(project(":shared"))

    // Ktor Server
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-server-auth:$ktorVersion")
    implementation("io.ktor:ktor-server-auth-jwt:$ktorVersion")
    implementation("io.ktor:ktor-server-cors:$ktorVersion")
    implementation("io.ktor:ktor-server-forwarded-header:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")
    implementation("io.ktor:ktor-server-rate-limit:$ktorVersion")
    implementation("io.ktor:ktor-server-request-validation:$ktorVersion")

    // Metrics
    implementation("io.ktor:ktor-server-metrics-micrometer:$ktorVersion")
    implementation("io.micrometer:micrometer-registry-prometheus:$micrometerVersion")

    // Database
    implementation("org.jetbrains.exposed:exposed-core:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-dao:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-java-time:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-json:$exposedVersion")
    implementation("org.postgresql:postgresql:$postgresVersion")
    implementation("com.zaxxer:HikariCP:$hikariVersion")
    implementation("org.flywaydb:flyway-core:$flywayVersion")
    implementation("org.flywaydb:flyway-database-postgresql:$flywayVersion")

    // Auth
    implementation("com.auth0:java-jwt:$javaJwtVersion")
    implementation("org.mindrot:jbcrypt:$jbcryptVersion")

    // Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$serializationVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")

    // Logging
    implementation("ch.qos.logback:logback-classic:$logbackVersion")

    // PDF generation
    implementation("com.itextpdf:itext-core:8.0.5")
    implementation("com.itextpdf:font-asian:8.0.5")

    // Test
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test:$kotlinVersion")
    testImplementation("io.mockk:mockk:1.13.13")
    testImplementation("com.h2database:h2:2.3.232")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}

kotlin {
    jvmToolchain(21)
}

tasks.withType<Jar> {
    manifest {
        attributes["Main-Class"] = "com.kakeibo.backend.ApplicationKt"
    }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE

    // Merge META-INF/services files from all dependencies (avoids overwriting by DuplicatesStrategy.EXCLUDE)
    val mergedServicesDir = layout.buildDirectory.dir("mergedServices")
    doFirst {
        val outDir = mergedServicesDir.get().asFile.resolve("META-INF/services")
        outDir.mkdirs()
        val serviceEntries = mutableMapOf<String, MutableSet<String>>()
        configurations.runtimeClasspath.get().forEach { file ->
            val tree = if (file.isFile && file.extension == "jar") zipTree(file) else fileTree(file)
            tree.matching { include("META-INF/services/**") }.forEach { svc ->
                serviceEntries.getOrPut(svc.name) { mutableSetOf() }
                    .addAll(svc.readLines().filter { it.isNotBlank() && !it.startsWith("#") })
            }
        }
        serviceEntries.forEach { (name, entries) ->
            outDir.resolve(name).writeText(entries.joinToString("\n") + "\n")
        }
    }

    from(configurations.runtimeClasspath.get().map { if (it.isDirectory) it else zipTree(it) }) {
        exclude("META-INF/services/**")
    }
    from(mergedServicesDir)
}
