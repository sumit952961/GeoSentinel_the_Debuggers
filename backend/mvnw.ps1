# ============================================================
# Maven Wrapper for PowerShell (mvnw.ps1)
# ============================================================
# Use this instead of mvnw.cmd on Windows PowerShell.
# Usage: .\mvnw.ps1 spring-boot:run
# ============================================================

$MavenProjectBaseDir = $PSScriptRoot
$WrapperJar = Join-Path $MavenProjectBaseDir ".mvn\wrapper\maven-wrapper.jar"

# Download wrapper JAR if missing
if (-not (Test-Path $WrapperJar)) {
    Write-Host "Downloading Maven Wrapper JAR..."
    (New-Object Net.WebClient).DownloadFile(
        "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar",
        $WrapperJar
    )
}

# Find java
$JavaExe = "java"
if ($env:JAVA_HOME) {
    $JavaExe = Join-Path $env:JAVA_HOME "bin\java.exe"
}

# Run Maven
& $JavaExe `
    --enable-native-access=ALL-UNNAMED `
    "-Dmaven.multiModuleProjectDirectory=$MavenProjectBaseDir" `
    -classpath $WrapperJar `
    org.apache.maven.wrapper.MavenWrapperMain `
    @args
