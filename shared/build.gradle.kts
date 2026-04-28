val serializationVersion: String by project

plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$serializationVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.7.1")
}

kotlin {
    jvmToolchain(21)
}
