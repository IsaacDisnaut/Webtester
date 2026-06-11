# Generates a self-signed TLS certificate for Mosquitto WSS.
# Run once from the project root:  .\mosquitto\generate-certs.ps1
# Output: mosquitto\certs\cert.pem  +  mosquitto\certs\key.pem

$outDir = "$PSScriptRoot\certs"
New-Item -ItemType Directory -Force $outDir | Out-Null

$certFile = "$outDir\cert.pem"
$keyFile  = "$outDir\key.pem"

# Try openssl first (available on Windows 10/11 and Git Bash)
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    Write-Host "Generating certs with openssl..."
    openssl req -x509 -nodes -newkey rsa:2048 `
        -keyout $keyFile -out $certFile `
        -days 3650 `
        -subj "/CN=localhost/O=VideoCall/C=TH"
    Write-Host "Done: $certFile"
    Write-Host "      $keyFile"
} else {
    # Fallback: PowerShell native (Windows only, exports pfx then converts)
    Write-Host "openssl not found, using New-SelfSignedCertificate..."
    $cert = New-SelfSignedCertificate `
        -DnsName "localhost" `
        -CertStoreLocation "cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(10) `
        -KeyAlgorithm RSA -KeyLength 2048

    $pfxPath = "$outDir\temp.pfx"
    $pwd     = ConvertTo-SecureString -String "temppass" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null

    # Convert pfx to PEM using openssl (must be installed)
    Write-Host "PFX exported. Install openssl and run:"
    Write-Host "  openssl pkcs12 -in $pfxPath -nocerts -nodes -out $keyFile -passin pass:temppass"
    Write-Host "  openssl pkcs12 -in $pfxPath -clcerts -nokeys -out $certFile -passin pass:temppass"
}

Write-Host ""
Write-Host "NOTE: Browsers will show a security warning for self-signed certs."
Write-Host "      To accept it, visit https://localhost:9443 once and click Advanced -> Proceed."
