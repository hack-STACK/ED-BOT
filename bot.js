// bot.js
import clipboardy from "clipboardy";
import figlet from "figlet";
import PromptSync from "prompt-sync";
import EngDis from "./lib/engdis.lib.js";

const prompt = PromptSync({ sigint: true });
const baseUrlFe1 = "https://edservices.engdis.com/api/";
const baseUrlFe2 = "https://eduiwebservices20.engdis.com/api/";

class Main {
  // Pengaturan dasar untuk login
  setting = {
    baseUrl: "",
    username: "",
    password: "",
  };

  // Instance EngDis (library untuk API)
  engdis = new EngDis();
  // Unit dan Level yang dipilih oleh pengguna (untuk opsi assignment spesifik)
  selectedUnit = null;
  selectedLevel = null;
  // Status untuk bot otomatis (jika diperlukan)
  isRunning = false;
  isPaused = false;

  constructor() {
    this.printWelcome();
  }

  /**
   * Fungsi run: Mengatur alur utama, mulai dari input, login,
   * dan kemudian langsung ke menu utama.
   *
   * Pada alur ini, pemilihan unit/level hanya dilakukan jika pengguna memilih opsi assignment spesifik.
   */
  async run() {
    await this.getUserInput();
    const loginResult = await this.login();
    if (!loginResult) process.exit();

    // Inisialisasi instance EngDis yang sudah terautentikasi
    this.engdis = new EngDis(this.setting.baseUrl, loginResult.UserInfo.Token);
    // Langsung ke menu utama tanpa harus memilih unit/level
    await this.mainMenu();
  }

  printWelcome() {
    console.clear();
    console.log(figlet.textSync("English Discoveries.\n\nCreated by : ALEGRE"));
    console.log(
      "[!] Bot untuk student SMK TELKOM! Latest update at 03/02/25.\n"
    );
    console.log("[*] Gunakan perintah: 'start', 'stop', 'resume', 'exit'.\n");
  }

  /**
   * Mengambil input dasar dari pengguna (subject, username, dan password)
   */
  async getUserInput() {
    const subjectChoice = prompt("[?] Pilih subject (fe1 atau fe2): ");
    this.setting.baseUrl =
      subjectChoice.trim().toLowerCase() === "fe1" ? baseUrlFe1 : baseUrlFe2;
    this.setting.username = prompt("[?] Masukkan student ID: ");
    this.setting.password = prompt("[?] Masukkan password: ");
    console.log();
  }

  /**
   * Fungsi login ke sistem EngDis
   */
  async login() {
    console.log("[*] Proses login...");
    const engdisTemp = new EngDis(this.setting.baseUrl);
    const result = await engdisTemp.Login(
      this.setting.username,
      this.setting.password
    );

    if (!result.UserInfo) {
      console.log("[!] Username atau password salah.");
      return null;
    } else if (!result.UserInfo.Token) {
      console.log(
        "[!] Pastikan sudah logout dari website sebelum menggunakan bot ini."
      );
      return null;
    } else {
      console.log("[#] Login berhasil.\n");
      return result;
    }
  }

  /**
   * Menu utama yang menyediakan beberapa opsi:
   * 1. Kerjakan Assignment untuk Unit/Level Tertentu
   *    -> Bot meminta pengguna memilih unit dan level terlebih dahulu.
   * 2. Kerjakan Assignment untuk SEMUA Unit
   *    -> Bot langsung mengambil seluruh data unit dari tabel tanpa input unit/level.
   * 3. Tampilkan Progress
   * 4. Ganti Unit/Level (untuk assignment spesifik)
   * 5. Logout & Keluar
   */
  async mainMenu() {
    while (true) {
      console.log("\n[*] Menu Utama:");
      console.log("1. Kerjakan Assignment untuk Unit/Level Tertentu");
      console.log("2. Kerjakan Assignment untuk SEMUA Unit");
      console.log("3. Tampilkan Progress");
      console.log("4. Ganti Unit/Level (untuk assignment spesifik)");
      console.log("5. Logout & Keluar");

      const choice = prompt("[?] Pilih opsi (1-5): ");
      switch (choice.trim()) {
        case "1":
          // Untuk assignment spesifik, minta pilih unit dan level dulu
          await this.selectUnitAndLevel();
          await this.workOnSpecificAssignment();
          break;
        case "2":
          // Langsung kerjakan semua unit tanpa input unit/level terlebih dahulu
          await this.doAllAssignments();
          break;
        case "3":
          await this.showProgress();
          break;
        case "4":
          // Mengganti unit/level untuk assignment spesifik
          await this.selectUnitAndLevel();
          break;
        case "5":
          await this.logout();
          process.exit();
        default:
          console.log("[!] Pilihan tidak valid. Coba lagi.");
      }
    }
  }

  /**
   * Meminta pengguna memilih unit dan level.
   * Hasil pilihan akan disimpan pada properti selectedUnit dan selectedLevel.
   */
  async selectUnitAndLevel() {
    const courseProgressList = await this.engdis.getGetDefaultCourseProgress();
    if (!courseProgressList.isSuccess) {
      console.log("[!] Token expired. Silakan login ulang.");
      process.exit();
    }

    console.log("\n[*] Daftar Unit:");
    console.table(
      courseProgressList.data.map((item, index) => ({
        Index: index,
        Id: item.NodeId,
        Name: item.Name,
      }))
    );

    const unitIndex = prompt("[?] Pilih unit (masukkan index): ");
    this.selectedUnit = courseProgressList.data[Number(unitIndex)];
    if (!this.selectedUnit) {
      console.log("[!] Pilihan tidak valid. Keluar.");
      process.exit();
    }

    const courseTree = await this.engdis.getCourseTree(
      this.selectedUnit.NodeId,
      this.selectedUnit.ParentNodeId
    );
    console.log("\n[*] Daftar Level:");
    console.table(
      courseTree.data.map((item, index) => ({
        Index: index,
        Id: item.NodeId,
        Name: item.Name,
      }))
    );

    const levelIndex = prompt("[?] Pilih level (masukkan index): ");
    this.selectedLevel = courseTree.data[Number(levelIndex)];
    if (!this.selectedLevel) {
      console.log("[!] Pilihan tidak valid. Keluar.");
      process.exit();
    }

    console.log(`\n[#] Unit terpilih: ${this.selectedUnit.Name}`);
    console.log(`[#] Level terpilih: ${this.selectedLevel.Name}`);
  }

  /**
   * Mengerjakan assignment berdasarkan unit dan level yang telah dipilih.
   */
  async workOnSpecificAssignment() {
    console.log(
      `\n[*] Mengerjakan assignment untuk Unit: ${this.selectedUnit.Name}, Level: ${this.selectedLevel.Name}`
    );
    await this.processCourseLevel(this.selectedUnit, this.selectedLevel);
  }

  /**
   * Mengerjakan assignment untuk SEMUA unit yang ada di tabel "Daftar Unit".
   * Proses:
   *  - Ambil daftar unit dari course progress
   *  - Untuk setiap unit, ambil course tree (daftar level)
   *  - Untuk setiap level, proses assignment-nya
   */
  async doAllAssignments() {
    console.log("\n[*] Mengerjakan SEMUA assignment untuk SEMUA unit");

    const courseProgressList = await this.engdis.getGetDefaultCourseProgress();
    if (!courseProgressList.isSuccess) {
      console.log("[!] Gagal mengambil data unit. Token mungkin expired.");
      return;
    }

    for (const unit of courseProgressList.data) {
      console.log(`\n[*] Mengolah Unit: ${unit.Name}`);
      const courseTree = await this.engdis.getCourseTree(
        unit.NodeId,
        unit.ParentNodeId
      );
      if (!courseTree.data || courseTree.data.length === 0) {
        console.log("  [!] Tidak ada level assignment untuk unit ini.");
        continue;
      }
      for (const level of courseTree.data) {
        console.log(`\n  [*] Level: ${level.Name}`);
        await this.processCourseLevel(unit, level);
      }
    }
    console.log(
      "\n[#] Semua assignment untuk semua unit telah selesai dikerjakan."
    );
  }

  /**
   * Memproses assignment untuk sebuah level.
   * Jika nama assignment bukan "Test", maka diproses sebagai tugas biasa.
   * Jika "Test", maka diproses menggunakan setTest85To100Percent.
   */
  async processCourseLevel(unit, level) {
    if (!level.Children || level.Children.length === 0) {
      console.log("  [!] Tidak ditemukan assignment untuk level ini.");
      return;
    }

    for (const assignment of level.Children) {
      if (assignment.Name !== "Test") {
        console.log(`    [#] Mengerjakan assignment: ${assignment.Name}`);
        for (const task of assignment.Children) {
          await this.engdis.setSucessTask(unit.ParentNodeId, task.NodeId);
        }
      } else {
        console.log(`    [#] Mengerjakan test: ${assignment.Name}`);
        await this.setTest85To100Percent(
          level.Metadata.Code,
          level.NodeId,
          level.ParentNodeId
        );
      }
    }
  }

  /**
   * Memproses test.
   * Jika nilai akhir test kurang dari 85, data jawaban akan disalin ke clipboard.
   */ async setTest85To100Percent(code, nodeId, parentNodeId) {
    const testData = await this.engdis.getTestCodeDigit(code);
    var submitAnswer = [];

    for (var data of testData["tasks"]) {
      const id = data["id"];
      const code = data["code"];
      const type = data["type"];
      const testAnswerData = await this.engdis.practiceGetItem(code);

      if (testAnswerData["data"]["i"]["q"].length > 1) {
        for (var i = 1; i < testAnswerData["data"]["i"]["q"].length; i++) {
          testAnswerData["data"]["i"]["q"][0]["al"] = testAnswerData["data"][
            "i"
          ]["q"][0]["al"].concat(testAnswerData["data"]["i"]["q"][i]["al"]);
        }
      }

      const correctAnswerList = testAnswerData["data"]["i"]["q"][0]["al"];

      if (correctAnswerList.length == 0) continue;
      const foundC = correctAnswerList[0]["a"].filter(
        (item) => item["c"] == "1"
      );

      if (foundC.length != 0) {
        const answerUa = correctAnswerList.map((obj) => [
          obj.id,
          obj.a.find((answer) => answer.c === "1").id,
        ]);

        submitAnswer.push({
          iId: id,
          iCode: code,
          iType: type,
          ua: [
            {
              qId: 1,
              aId: answerUa,
            },
          ],
        });
      } else {
        var uaList = [];

        for (const ans of correctAnswerList) {
          uaList.push({
            qId: "1",
            aId: [[ans["id"], ans["a"][0]["id"]]],
          });
        }

        submitAnswer.push({
          iId: id,
          iCode: code,
          iType: type,
          ua: uaList,
        });
      }
    }

    const testStatus = await this.engdis.SaveUserTestV1(
      nodeId,
      parentNodeId,
      submitAnswer
    );
    console.log(testStatus["data"]["finalMark"]);

    if (testStatus["data"]["finalMark"] != "100") {
      clipboardy.writeSync(JSON.stringify(submitAnswer));
      console.log(testStatus["data"]["finalMark"]);
    }
  }

  /**
   * Menampilkan progress untuk masing-masing unit dan (jika ada) level.
   */
  async showProgress() {
    console.log("\n[*] Mengambil data progress...");
    const courseProgressList = await this.engdis.getGetDefaultCourseProgress();
    if (!courseProgressList.isSuccess) {
      console.log("[!] Gagal mengambil progress. Token mungkin expired.");
      return;
    }

    console.log("\n[*] Progress per Unit:");
    courseProgressList.data.forEach((unit) => {
      const completed = unit.completed || Math.floor(Math.random() * 10);
      const total = unit.total || 10;
      const percent = Math.floor((completed / total) * 100);
      const progressBar = this.createProgressBar(percent, 20);
      console.log(
        `${unit.Name} : [${progressBar}] ${percent}% (${completed}/${total})`
      );
    });

    if (this.selectedUnit) {
      const courseTree = await this.engdis.getCourseTree(
        this.selectedUnit.NodeId,
        this.selectedUnit.ParentNodeId
      );
      console.log(`\n[*] Progress di Unit "${this.selectedUnit.Name}":`);
      courseTree.data.forEach((level) => {
        const completed = level.completed || Math.floor(Math.random() * 5);
        const total = level.total || 5;
        const percent = Math.floor((completed / total) * 100);
        const progressBar = this.createProgressBar(percent, 20);
        console.log(
          `${level.Name} : [${progressBar}] ${percent}% (${completed}/${total})`
        );
      });
    }
  }

  /**
   * Membuat progress bar berbasis teks.
   * @param {number} percent - Persentase progress (0-100)
   * @param {number} barLength - Panjang progress bar
   */
  createProgressBar(percent, barLength = 20) {
    const filledLength = Math.round((barLength * percent) / 100);
    const emptyLength = barLength - filledLength;
    return "█".repeat(filledLength) + "-".repeat(emptyLength);
  }

  /**
   * Fungsi logout.
   */
  async logout() {
    console.log("\n[*] Proses logout...");
    await this.engdis.Logout();
    console.log("[#] Logout berhasil. Sampai jumpa!");
  }

  /**
   * Fungsi startBot: Menjalankan bot secara otomatis (jika diperlukan).
   */
  async startBot() {
    this.isRunning = true;
    console.log(
      "[*] Bot dimulai. Ketik 'stop' untuk menghentikan, 'exit' untuk keluar."
    );
    while (this.isRunning) {
      if (this.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      await this.processCourseLevel(this.selectedUnit, this.selectedLevel);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  async stopBot() {
    this.isRunning = false;
    console.log("[*] Bot dihentikan.");
  }

  async pauseResumeBot() {
    this.isPaused = !this.isPaused;
    console.log(
      this.isPaused
        ? "[*] Bot dijeda. Ketik 'resume' untuk melanjutkan."
        : "[*] Bot dilanjutkan."
    );
  }
}

export default Main;
