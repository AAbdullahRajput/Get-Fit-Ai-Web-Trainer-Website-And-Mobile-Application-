buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.google.gms:google-services:4.5.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

subprojects {
    project.evaluationDependsOn(":app")
}

// Force a consistent NDK version across every native plugin module (the version Flutter itself asked for).
subprojects {
    fun applyNdk() {
        extensions.findByType(com.android.build.gradle.BaseExtension::class.java)?.let {
            it.ndkVersion = "28.2.13676358"
        }
    }
    if (project.state.executed) {
        applyNdk()
    } else {
        afterEvaluate { applyNdk() }
    }
}

// Force every Android library subproject (including plugins like agora_rtc_engine
// that hardcode an old compileSdkVersion) to compile against a newer SDK.
subprojects {
    plugins.withId("com.android.library") {
        extensions.findByType(com.android.build.api.variant.LibraryAndroidComponentsExtension::class.java)
            ?.finalizeDsl { extension ->
                extension.compileSdk = 36
            }
    }
}

// Pin the same androidx versions the working project pins.
configurations.all {
    resolutionStrategy {
        force("androidx.browser:browser:1.8.0")
        force("androidx.core:core-ktx:1.13.1")
        force("androidx.core:core:1.13.1")
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}