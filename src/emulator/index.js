import {
  DisplayLoop,
  ScriptAudioProcessor,
  RetroAppWrapper,
  LOG,
} from '@webrcade/app-common';

export class Emulator extends RetroAppWrapper {

  GAME_SRAM_NAME = 'game.srm';
  SAVE_NAME = 'sav';

  constructor(app, debug = false) {
    super(app, debug);

    this.fdsGame = false;
    window.emulator = this;

    this.lastFrequency = 60;
    this.frequency = 60;

    this.audioStarted = 0;
    this.total = 0;
    this.count = 0;

    this.audioCallback = (offset, length) => {
      this.total += length;
      this.count = this.count + 1;

      if (this.count === 60) {
        //console.log("total: " + this.total);
        this.total = 0;
        this.count = 0;
      }

      length = length << 1;
      const audioArray = new Int16Array(window.Module.HEAP16.buffer, offset, length);
      this.audioProcessor.storeSoundCombinedInput(audioArray, 2, length, 0, 32768);
    };
  }

  createAudioProcessor() {
    return new ScriptAudioProcessor(
      2,
      48000,
      8192 + 4096,
      2048
    ).setDebug(this.debug);
  }

  onFrame() {
    if (this.audioStarted !== -1) {
      if (this.audioStarted > 1) {
        this.audioStarted = -1;
        // Start the audio processor
        this.audioProcessor.start();
      } else {
        this.audioStarted++;
      }
    }
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

  setRoms(uid, frontendArray, biosBuffers, romBytes, ext) {
    super.setRoms(uid, frontendArray, biosBuffers, romBytes, ext);
    // Detect FDS by magic bytes:
    //   headered format:  FDS\x1a  (0x46 0x44 0x53 0x1A)
    //   raw/headerless:   \x01*NINTENDO-HVC*  (most common in the wild)
    this.isFdsContent = false;
    if (romBytes && romBytes.length >= 4) {
      if (romBytes[0] === 0x46 && romBytes[1] === 0x44 &&
          romBytes[2] === 0x53 && romBytes[3] === 0x1A) {
        this.isFdsContent = true;
      } else if (romBytes.length >= 15 &&
          romBytes[0] === 0x01 &&
          romBytes[1] === 0x2A && romBytes[2] === 0x4E && romBytes[3] === 0x49 &&
          romBytes[4] === 0x4E && romBytes[5] === 0x54 && romBytes[6] === 0x45 &&
          romBytes[7] === 0x4E && romBytes[8] === 0x44 && romBytes[9] === 0x4F &&
          romBytes[10] === 0x2D && romBytes[11] === 0x48 && romBytes[12] === 0x56 &&
          romBytes[13] === 0x43 && romBytes[14] === 0x2A) {
        this.isFdsContent = true;
      }
    }
  }

  getHashFileExtension() {
    if (this.isFdsContent) {
      return 'fds';
    }
    return 'nes';
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

  setIsNtsc(val) {
    this.frequency = val ? 60 : 50;
    console.log("Set frequency to: " + this.frequency);
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

  async applyGameSettings() {
    // // MOCK: fire a test achievement toast every 10 seconds
    // const mockAchievements = [
    //   { title: 'Off to the Tropics', subtitle: 'Clear Stage 1: Jungle', badge: '408441' },
    //   { title: 'Mission Impossible', subtitle: 'Clear the game without dying', badge: '408442' },
    //   { title: 'Speed Runner', subtitle: 'Complete Stage 1 in under 60 seconds', badge: '408443' },
    // ];
    // let mockIdx = 0;
    // setInterval(() => {
    //   const a = mockAchievements[mockIdx % mockAchievements.length];
    //   this.onAchievementUnlocked(a.title, a.subtitle, a.badge);
    //   mockIdx++;
    // }, 10000);
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

  createDisplayLoop(debug) {
    const loop = new DisplayLoop(
      this.frequency,
      true, // vsync
      debug, // debug
      false,
    );
    // loop.setAdjustTimestampEnabled(false);
    return loop;
  }

  getDisplayLoopReturn() {
    if (this.lastFrequency !== this.frequency) {
      this.lastFrequency = this.frequency;
      console.log('returning: ' + this.frequency);
      return this.frequency;
    }
    return undefined;
  }

  getShotAspectRatio() { return this.getDefaultAspectRatio(); }
}

