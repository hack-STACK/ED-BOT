// main.js
import Main from "./bot.js";

(async () => {
  // Membuat instance tunggal dari Main
  const mainClass = new Main();
  await mainClass.run();

  // Mengatur input perintah dari terminal
  process.stdin.on("data", (data) => {
    const input = data.toString().trim().toLowerCase();

    if (input === "start" && !mainClass.isRunning) {
      mainClass.startBot();
    } else if (input === "stop" && mainClass.isRunning) {
      mainClass.stopBot();
    } else if (input === "resume" && mainClass.isPaused) {
      mainClass.pauseResumeBot();
    } else if (input === "exit") {
      console.log("[*] Keluar...");
      process.exit();
    } else {
      console.log("[!] Perintah tidak dikenal. Gunakan 'start', 'stop', 'resume', atau 'exit'.");
    }
  });
})();
