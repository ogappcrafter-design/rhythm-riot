/**
 * Raw librosa analysis output for the five launch tracks (Section 5.1 of the spec).
 * This is reference data: it feeds build-time chart generation (scripts/generateCharts.mjs
 * reads its own embedded copy) and is kept here for any runtime display/debug needs.
 *
 * Only the first beats/onsets were captured in the source analysis; full charts are
 * synthesized from tempo + duration + density + energy statistics.
 */
export interface TrackAnalysis {
  duration_sec: number;
  tempo_bpm: number;
  num_beats: number;
  num_onsets: number;
  onset_density_per_sec: number;
  avg_energy: number;
  peak_energy: number;
  energy_std: number;
  first_10_beat_times: number[];
  first_15_onset_times: number[];
  high_energy_window_count: number;
}

export const TRACK_ANALYSIS: Record<string, TrackAnalysis> = {
  "I Don't Care Tonight": {
    duration_sec: 173.08,
    tempo_bpm: 103.4,
    num_beats: 292,
    num_onsets: 599,
    onset_density_per_sec: 3.46,
    avg_energy: 0.1282,
    peak_energy: 0.3846,
    energy_std: 0.0686,
    first_10_beat_times: [0.163, 0.743, 1.324, 1.904, 2.554, 3.135, 3.738, 4.342, 4.946, 5.526],
    first_15_onset_times: [
      0.163, 0.441, 0.743, 1.045, 1.277, 1.37, 1.881, 2.554, 2.856, 3.135, 3.46, 3.738, 3.971,
      4.319, 4.644,
    ],
    high_energy_window_count: 121,
  },
  'Where the Inside Opens Wide': {
    duration_sec: 231.05,
    tempo_bpm: 129.2,
    num_beats: 444,
    num_onsets: 826,
    onset_density_per_sec: 3.57,
    avg_energy: 0.17,
    peak_energy: 0.488,
    energy_std: 0.0893,
    first_10_beat_times: [9.125, 9.613, 10.101, 10.565, 11.029, 11.517, 12.005, 12.469, 12.934, 13.421],
    first_15_onset_times: [
      4.365, 4.853, 5.294, 5.805, 6.269, 6.757, 6.989, 7.198, 7.709, 8.173, 8.661, 9.102, 9.358,
      9.613, 10.077,
    ],
    high_energy_window_count: 293,
  },
  'Who Moved the Moon': {
    duration_sec: 243.05,
    tempo_bpm: 95.7,
    num_beats: 374,
    num_onsets: 865,
    onset_density_per_sec: 3.56,
    avg_energy: 0.1903,
    peak_energy: 0.3956,
    energy_std: 0.08,
    first_10_beat_times: [5.224, 5.851, 6.478, 7.105, 7.732, 8.382, 8.986, 9.636, 10.24, 10.867],
    first_15_onset_times: [
      4.598, 4.923, 5.201, 5.526, 5.851, 6.177, 6.455, 6.803, 7.105, 7.43, 7.732, 8.057, 8.359,
      8.615, 8.684,
    ],
    high_energy_window_count: 829,
  },
  'Dub Steps Trip': {
    duration_sec: 265.81,
    tempo_bpm: 136.0,
    num_beats: 589,
    num_onsets: 949,
    onset_density_per_sec: 3.57,
    avg_energy: 0.187,
    peak_energy: 0.4477,
    energy_std: 0.0812,
    first_10_beat_times: [4.899, 5.341, 5.782, 6.223, 6.687, 7.129, 7.57, 8.011, 8.452, 8.893],
    first_15_onset_times: [
      2.392, 2.461, 2.577, 2.694, 2.926, 3.158, 3.39, 3.692, 4.063, 4.899, 5.132, 5.341, 5.573,
      6.037, 6.223,
    ],
    high_energy_window_count: 359,
  },
  'Everyday G': {
    duration_sec: 214.69,
    tempo_bpm: 152.0,
    num_beats: 529,
    num_onsets: 952,
    onset_density_per_sec: 4.43,
    avg_energy: 0.1484,
    peak_energy: 0.4115,
    energy_std: 0.0723,
    first_10_beat_times: [0.163, 0.58, 0.975, 1.393, 1.788, 2.206, 2.601, 2.995, 3.413, 3.808],
    first_15_onset_times: [
      0.163, 0.395, 0.58, 0.952, 1.37, 1.788, 1.997, 2.183, 2.577, 2.972, 3.39, 3.808, 3.994,
      4.203, 4.412,
    ],
    high_energy_window_count: 508,
  },
};
