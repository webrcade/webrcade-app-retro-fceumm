import {
  RetroAppWrapper,
  LOG
} from '@webrcade/app-common';

export class Emulator extends RetroAppWrapper {

  GAME_SRAM_NAME = 'game.srm';
  SAVE_NAME = 'sav';

  constructor(app, debug = false) {
    super(app, debug);

    this.fdsGame = false;
    window.emulator = this;
  }

  detectPal(filename) {
    if (!filename) return false;

    const SEARCH = [
      '(pal)',
      '(e)',
      '(europe)',
      '(d)',
      '(f)',
      '(g)',
      '(gr)',
      '(i)',
      '(nl)',
      '(no)',
      '(r)',
      '(s)',
      '(sw)',
      '(uk)',
    ];

    filename = filename.toLowerCase();
    for (const s of SEARCH) {
      if (filename.indexOf(s) !== -1) {
        return true;
      }
    }

    return false;
  }

  getScriptUrl() {
    return 'js/fceumm_libretro.js';
  }

  getPrefs() {
    return this.prefs;
  }

  async saveState() {
    const { saveStatePath, started } = this;
    const { FS, Module } = window;

    try {
      if (!started) {
        return;
      }

      // Save to files
      Module._cmd_savefiles();

      let path = '';
      const files = [];
      let s = null;

      path = `/home/web_user/retroarch/userdata/saves/${this.GAME_SRAM_NAME}`;
      LOG.info('Checking: ' + path);
      try {
        s = FS.readFile(path);
        if (s) {
          LOG.info('Found save file: ' + path);
          files.push({
            name: this.SAVE_NAME,
            content: s,
          });
        }
      } catch (e) {}

      if (files.length > 0) {
        if (await this.getSaveManager().checkFilesChanged(files)) {
          await this.getSaveManager().save(
            saveStatePath,
            files,
            this.saveMessageCallback,
          );
        }
      } else {
        await this.getSaveManager().delete(path);
      }
    } catch (e) {
      LOG.error('Error persisting save state: ' + e);
    }
  }

  async loadState() {
    const { saveStatePath } = this;
    const { FS } = window;

    // Write the save state (if applicable)
    try {
      // Load
      const files = await this.getSaveManager().load(
        saveStatePath,
        this.loadMessageCallback,
      );

      if (files) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.name === this.SAVE_NAME) {
            LOG.info(`writing ${this.GAME_SRAM_NAME} file`);
            FS.writeFile(
              `/home/web_user/retroarch/userdata/saves/${this.GAME_SRAM_NAME}`,
              f.content,
            );
          }
        }

        // Cache the initial files
        await this.getSaveManager().checkFilesChanged(files);
      }
    } catch (e) {
      LOG.error('Error loading save state: ' + e);
    }
  }

  isEscapeHackEnabled() {
    return false;
  }

  isPal() {
    return this.getProps().pal || this.detectPal(this.filename) ? 1 : 0;
  }

  fdsBiosMissing() {
    this.setExitErrorMessage("FDS BIOS image (disksys.rom) missing");
  }

  setFdsGame(val) {
    this.fdsGame = val;
  }

  isFdsGame() {
    return this.fdsGame;
  }

  flipDisk() {
    const { Module } = window;
    setTimeout(() => {
      Module._wrc_set_options(this.OPT1);
      setTimeout(() => {
        Module._wrc_set_options(this.OPT2);
        setTimeout(() => {
          Module._wrc_set_options(this.OPT1);
        }, 300);
      }, 300);
    }, 300);
  }

  applyGameSettings() {
    // const { Module } = window;
    // const props = this.getProps();
    // let options = 0;
    // Module._wrc_set_options(options);
  }

  isForceAspectRatio() {
    return false;
  }

  getDefaultAspectRatio() {
    return 1.333;
  }

  resizeScreen(canvas) {
    this.canvas = canvas;
    this.updateScreenSize();
  }

  getShotAspectRatio() { return this.getDefaultAspectRatio(); }
}
