// No-op: cert generation removed.
// On Windows IoT LTSC, reliable cert generation requires OpenSSL.
// The backend serves HTTP on port 27890 (no cert needed).
// For HTTPS, install OpenSSL and run:
//   openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 3650 -nodes -subj "/CN=localhost"
console.log("SSL cert generation skipped (install OpenSSL for HTTPS)");
