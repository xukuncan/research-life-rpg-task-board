const pixelShapes = {
  home: [[4, 1, 2, 2, 'dark'], [3, 3, 2, 2, 'dark'], [2, 5, 12, 2, 'dark'], [3, 7, 10, 7, 'green'], [6, 9, 4, 5, 'paper']],
  tasks: [[3, 1, 10, 2, 'dark'], [4, 4, 1, 1, 'gold'], [6, 4, 7, 1, 'dark'], [4, 7, 1, 1, 'green'], [6, 7, 7, 1, 'dark'], [4, 10, 1, 1, 'green'], [6, 10, 7, 1, 'dark'], [3, 13, 10, 2, 'dark']],
  board: [[1, 3, 4, 10, 'green'], [6, 3, 4, 10, 'gold'], [11, 3, 4, 10, 'rose'], [1, 1, 14, 2, 'dark'], [1, 14, 14, 1, 'dark']],
  calendar: [[2, 2, 12, 12, 'paper'], [2, 2, 12, 3, 'green'], [4, 1, 2, 4, 'dark'], [10, 1, 2, 4, 'dark'], [4, 7, 2, 2, 'gold'], [8, 7, 2, 2, 'rose'], [4, 11, 2, 2, 'green'], [8, 11, 2, 2, 'gold']],
  growth: [[7, 1, 2, 3, 'gold'], [5, 4, 6, 2, 'gold'], [4, 6, 8, 2, 'dark'], [3, 8, 10, 4, 'green'], [2, 12, 12, 2, 'dark'], [6, 10, 4, 2, 'paper']],
  rewards: [[3, 3, 10, 2, 'dark'], [2, 5, 12, 7, 'gold'], [4, 12, 8, 2, 'dark'], [6, 7, 4, 4, 'paper'], [7, 8, 2, 2, 'gold']],
  daily: [[7, 1, 2, 3, 'gold'], [3, 5, 2, 2, 'gold'], [11, 5, 2, 2, 'gold'], [5, 4, 6, 7, 'gold'], [3, 11, 10, 2, 'dark'], [6, 13, 4, 2, 'dark']],
  achievements: [[7, 1, 2, 3, 'gold'], [4, 4, 8, 2, 'gold'], [3, 6, 10, 5, 'rose'], [5, 11, 6, 2, 'dark'], [6, 13, 4, 2, 'green']],
  star: [[7, 1, 2, 4, 'gold'], [4, 5, 8, 2, 'gold'], [1, 7, 14, 2, 'gold'], [4, 9, 8, 2, 'gold'], [5, 11, 6, 3, 'gold']],
  flask: [[5, 1, 6, 2, 'dark'], [6, 3, 4, 3, 'dark'], [5, 6, 6, 2, 'dark'], [4, 8, 8, 5, 'green'], [3, 13, 10, 2, 'dark'], [7, 10, 3, 2, 'paper']],
  book: [[2, 3, 6, 10, 'blue'], [8, 3, 6, 10, 'paper'], [1, 2, 7, 2, 'dark'], [8, 2, 7, 2, 'dark'], [2, 13, 12, 2, 'dark'], [4, 6, 3, 1, 'paper'], [9, 6, 3, 1, 'blue']],
  briefcase: [[2, 5, 12, 8, 'gold'], [5, 2, 6, 3, 'dark'], [6, 3, 4, 2, 'paper'], [1, 7, 14, 2, 'dark'], [7, 7, 2, 2, 'dark']],
  code: [[2, 3, 3, 2, 'green'], [1, 6, 4, 2, 'green'], [2, 9, 3, 2, 'green'], [11, 3, 3, 2, 'rose'], [11, 6, 4, 2, 'rose'], [11, 9, 3, 2, 'rose'], [7, 2, 2, 3, 'dark'], [6, 5, 2, 3, 'dark'], [5, 8, 2, 3, 'dark'], [4, 11, 2, 2, 'dark']],
  heart: [[3, 3, 4, 3, 'rose'], [9, 3, 4, 3, 'rose'], [1, 5, 14, 4, 'rose'], [3, 9, 10, 2, 'rose'], [5, 11, 6, 2, 'rose'], [7, 13, 2, 1, 'rose']],
  boss: [[6, 1, 4, 2, 'gold'], [4, 3, 8, 2, 'dark'], [2, 5, 12, 7, 'rose'], [4, 12, 8, 2, 'dark'], [5, 7, 2, 2, 'paper'], [9, 7, 2, 2, 'paper'], [7, 9, 2, 2, 'dark']],
  coin: [[5, 1, 6, 2, 'dark'], [3, 3, 10, 2, 'gold'], [2, 5, 12, 7, 'gold'], [3, 12, 10, 2, 'gold'], [5, 14, 6, 1, 'dark'], [7, 6, 2, 5, 'dark']],
  leaf: [[8, 1, 5, 2, 'green'], [5, 3, 8, 2, 'green'], [3, 5, 9, 3, 'green'], [4, 8, 7, 2, 'green'], [7, 10, 3, 2, 'green'], [4, 12, 2, 2, 'dark'], [7, 7, 2, 2, 'paper']],
  target: [[6, 1, 4, 2, 'dark'], [3, 3, 10, 2, 'green'], [2, 5, 12, 7, 'green'], [3, 12, 10, 2, 'dark'], [6, 7, 4, 4, 'paper'], [7, 8, 2, 2, 'rose']],
  medal: [[3, 1, 4, 6, 'blue'], [9, 1, 4, 6, 'rose'], [4, 6, 8, 2, 'dark'], [3, 8, 10, 5, 'gold'], [5, 10, 6, 2, 'paper'], [6, 13, 4, 2, 'dark']],
  sound: [[2, 6, 3, 4, 'dark'], [5, 4, 3, 8, 'green'], [8, 2, 2, 12, 'green'], [11, 4, 2, 2, 'gold'], [13, 6, 2, 4, 'gold'], [11, 10, 2, 2, 'gold']],
  mute: [[2, 6, 3, 4, 'dark'], [5, 4, 3, 8, 'green'], [8, 2, 2, 12, 'green'], [11, 5, 4, 2, 'rose'], [13, 7, 2, 2, 'rose'], [11, 9, 4, 2, 'rose']],
};

const pixelPalette = { dark: '#26352b', paper: '#f4f0dc', green: '#77a15b', gold: '#d5a944', rose: '#cf8d79', blue: '#729ab0' };
window.PixelUI = Object.freeze({
  icon(name, className = 'pixel-svg') {
    const shapes = pixelShapes[name] || pixelShapes.star;
    return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${shapes.map(([x, y, width, height, color]) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${pixelPalette[color]}"/>`).join('')}</svg>`;
  },
  play(effect = 'complete') {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return;
    try {
      const context = new AudioContextType();
      const patterns = {
        open: [[440, 0, 0.045, 'triangle', 0.025], [660, 0.045, 0.06, 'square', 0.035]],
        create: [[523, 0, 0.07, 'square', 0.04], [659, 0.075, 0.07, 'square', 0.04], [784, 0.15, 0.11, 'triangle', 0.045]],
        save: [[784, 0, 0.06, 'square', 0.035], [988, 0.07, 0.11, 'triangle', 0.045]],
        status: [[587, 0, 0.06, 'square', 0.035], [784, 0.07, 0.08, 'square', 0.04]],
        complete: [[660, 0, 0.08, 'square', 0.045], [880, 0.09, 0.08, 'square', 0.045], [1175, 0.18, 0.14, 'triangle', 0.05]],
        unlock: [[523, 0, 0.09, 'square', 0.04], [659, 0.1, 0.09, 'square', 0.04], [784, 0.2, 0.09, 'square', 0.045], [1047, 0.31, 0.09, 'square', 0.045], [1319, 0.42, 0.18, 'triangle', 0.05]],
        reward: [[784, 0, 0.07, 'square', 0.04], [988, 0.08, 0.07, 'square', 0.04], [1175, 0.17, 0.13, 'triangle', 0.05]],
        delete: [[784, 0, 0.07, 'square', 0.035], [587, 0.09, 0.08, 'square', 0.035], [392, 0.19, 0.14, 'triangle', 0.04]],
        mood: [[659, 0, 0.06, 'triangle', 0.035], [784, 0.07, 0.1, 'triangle', 0.04]],
        error: [[392, 0, 0.1, 'square', 0.04], [330, 0.11, 0.13, 'square', 0.04]],
        toggle: [[440, 0, 0.07, 'square', 0.035], [660, 0.08, 0.09, 'triangle', 0.04]],
      };
      const start = context.currentTime;
      (patterns[effect] || patterns.complete).forEach(([frequency, offset, duration = 0.08, waveform = 'square', volume = 0.045]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = start + offset;
        oscillator.type = waveform;
        oscillator.frequency.setValueAtTime(frequency, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + duration + 0.01);
      });
      window.setTimeout(() => context.close(), 750);
    } catch { /* Audio is optional; unsupported or blocked playback must not affect task flows. */ }
  },
});
