/**
 * One-shot branding sting ("shine") for the FloatSkyward splash.
 *
 * Plays a single short audio cue when the branding screen appears. In the native Android
 * app the WebView allows autoplay, so it rings out with the logo on a cold launch. On the
 * web/PWA, browsers block audio until a user gesture — so if the initial play is refused we
 * arm a one-shot listener and fire on the first touch/click/key instead of failing silently.
 *
 * Degrades to nothing where audio can't be created or decoded.
 */
const SRC = `${import.meta.env.BASE_URL}shine.mp3`;

class BrandSound {
  private el: HTMLAudioElement | null = null;
  private played = false;
  private armed = false;

  /** Play the sting once. `volume` is 0..1 (typically the SFX setting); <=0 stays silent. */
  play(volume: number): void {
    if (this.played || typeof Audio === 'undefined') return;
    const vol = Math.max(0, Math.min(1, volume));
    if (vol <= 0) return;

    if (!this.el) {
      this.el = new Audio(SRC);
      this.el.preload = 'auto';
      (this.el as unknown as { playsInline: boolean }).playsInline = true;
    }
    this.el.volume = vol;

    void this.el
      .play()
      .then(() => {
        this.played = true;
        this.disarm();
      })
      .catch(() => {
        // Autoplay blocked (web/PWA before any gesture) — fire on the first interaction.
        this.arm();
      });
  }

  private onGesture = (): void => {
    if (this.played || !this.el) return;
    void this.el
      .play()
      .then(() => {
        this.played = true;
        this.disarm();
      })
      .catch(() => {
        /* still blocked — leave armed */
      });
  };

  private arm(): void {
    if (this.armed || typeof window === 'undefined') return;
    this.armed = true;
    window.addEventListener('pointerdown', this.onGesture, { capture: true });
    window.addEventListener('touchstart', this.onGesture, { capture: true });
    window.addEventListener('keydown', this.onGesture, { capture: true });
  }

  private disarm(): void {
    if (!this.armed || typeof window === 'undefined') return;
    this.armed = false;
    window.removeEventListener('pointerdown', this.onGesture, { capture: true });
    window.removeEventListener('touchstart', this.onGesture, { capture: true });
    window.removeEventListener('keydown', this.onGesture, { capture: true });
  }
}

export const brandSound = new BrandSound();
