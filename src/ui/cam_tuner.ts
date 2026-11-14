import * as THREE from 'three';
import { CameraConfig } from '../config/constants';
import { applyCameraTuning } from '../render/camera';

export type CameraTuningCallback = (config: CameraConfig) => void;

interface SliderDef {
  key: keyof CameraConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderDef[] = [
  { key: 'pitch', label: 'Pitch', min: 25, max: 75, step: 0.5, unit: '°' },
  { key: 'yaw', label: 'Yaw', min: 0, max: 55, step: 0.5, unit: '°' },
  { key: 'fov', label: 'FOV', min: 35, max: 75, step: 0.5, unit: '°' },
  { key: 'height', label: 'Height', min: 12, max: 55, step: 0.5, unit: '' },
  { key: 'posX', label: 'Cam X', min: -25, max: 5, step: 0.2, unit: '' },
  { key: 'posZ', label: 'Cam Z', min: -20, max: 10, step: 0.2, unit: '' },
  { key: 'lookAtDistance', label: 'Look Dist', min: 10, max: 70, step: 1, unit: '' }
];

export class CameraTunerPanel {
  private panelEl: HTMLElement | null = null;
  private camera: THREE.PerspectiveCamera;
  private config: CameraConfig;
  private onUpdate: CameraTuningCallback;
  private isMinimized: boolean = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    initialConfig: CameraConfig,
    onUpdate: CameraTuningCallback
  ) {
    this.camera = camera;
    this.config = { ...initialConfig };
    this.onUpdate = onUpdate;

    if (this.isEnabled()) {
      this.initDOM();
    }
  }

  private isEnabled(): boolean {
    if (typeof window === 'undefined' || !window.location) return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('camTune');
  }

  private initDOM(): void {
    const container = document.getElementById('game-container');
    if (!container) return;

    const panel = document.createElement('div');
    panel.id = 'cam-tuner-panel';
    panel.style.cssText = `
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 8px);
      right: calc(env(safe-area-inset-right, 0px) + 8px);
      width: 220px;
      max-height: calc(100% - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 120px);
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      padding: 10px;
      color: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      z-index: 2000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      overflow-y: auto;
      pointer-events: auto;
      touch-action: pan-y;
    `;

    // Prevent touch/pointer interaction inside tuner panel from triggering cannon drag
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());
    panel.addEventListener('pointerup', (e) => e.stopPropagation());

    // Header with minimize/restore toggle
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    `;

    const title = document.createElement('span');
    title.textContent = '🎥 Cam Tuner';
    title.style.fontWeight = 'bold';
    title.style.color = '#38bdf8';

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Hide';
    toggleBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #fff;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 10px;
      cursor: pointer;
      min-height: 28px;
    `;
    toggleBtn.onclick = () => this.toggleMinimize();

    header.appendChild(title);
    header.appendChild(toggleBtn);
    panel.appendChild(header);

    // Body content (sliders and actions)
    const body = document.createElement('div');
    body.id = 'cam-tuner-body';

    for (const sliderDef of SLIDERS) {
      const row = document.createElement('div');
      row.style.cssText = `
        min-height: 48px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        margin-bottom: 4px;
      `;

      const labelRow = document.createElement('div');
      labelRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 2px;';

      const label = document.createElement('span');
      label.textContent = sliderDef.label;
      label.style.color = '#94a3b8';

      const valDisplay = document.createElement('span');
      const currentVal = this.config[sliderDef.key];
      valDisplay.id = `val-${sliderDef.key}`;
      valDisplay.textContent = `${currentVal}${sliderDef.unit}`;
      valDisplay.style.color = '#00ff88';

      labelRow.appendChild(label);
      labelRow.appendChild(valDisplay);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(sliderDef.min);
      input.max = String(sliderDef.max);
      input.step = String(sliderDef.step);
      input.value = String(currentVal);
      input.style.cssText = `
        width: 100%;
        height: 28px;
        cursor: pointer;
        accent-color: #38bdf8;
      `;

      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        (this.config as unknown as Record<string, number>)[sliderDef.key] = val;
        valDisplay.textContent = `${val}${sliderDef.unit}`;
        this.apply();
      });

      row.appendChild(labelRow);
      row.appendChild(input);
      body.appendChild(row);
    }

    // Query String Button (48dp touch target)
    const qsBtn = document.createElement('button');
    qsBtn.id = 'btn-show-qs';
    qsBtn.textContent = 'Show Query String';
    qsBtn.style.cssText = `
      width: 100%;
      min-height: 48px;
      margin-top: 8px;
      background: #0284c7;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      touch-action: manipulation;
    `;
    qsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showQueryStringModal();
    });

    body.appendChild(qsBtn);
    panel.appendChild(body);

    container.appendChild(panel);
    this.panelEl = panel;
  }

  private toggleMinimize(): void {
    const body = document.getElementById('cam-tuner-body');
    const btn = this.panelEl?.querySelector('button');
    if (!body || !btn) return;

    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      body.style.display = 'none';
      btn.textContent = 'Show';
    } else {
      body.style.display = 'block';
      btn.textContent = 'Hide';
    }
  }

  private apply(): void {
    applyCameraTuning(this.camera, this.config);
    this.onUpdate(this.config);
  }

  public getQueryString(): string {
    const c = this.config;
    return `?camPitch=${c.pitch}&camYaw=${c.yaw}&camFov=${c.fov}&camHeight=${c.height}&camX=${c.posX}&camZ=${c.posZ}&camLookAtDistance=${c.lookAtDistance}`;
  }

  private showQueryStringModal(): void {
    const qs = this.getQueryString();
    console.info('[CamTuner Query String]:', qs);

    // Remove existing modal if any
    const existing = document.getElementById('cam-qs-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'cam-qs-modal';
    modal.addEventListener('pointerdown', (e) => e.stopPropagation());
    modal.addEventListener('pointerup', (e) => e.stopPropagation());
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 85%;
      max-width: 340px;
      background: #0f172a;
      border: 1px solid #38bdf8;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      z-index: 3000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    `;

    const title = document.createElement('div');
    title.textContent = 'Camera Query Parameters:';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.color = '#38bdf8';

    const textarea = document.createElement('textarea');
    textarea.value = qs;
    textarea.readOnly = true;
    textarea.style.cssText = `
      width: 100%;
      height: 70px;
      background: #1e293b;
      color: #00ff88;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      padding: 8px;
      font-family: inherit;
      font-size: 11px;
      resize: none;
      box-sizing: border-box;
    `;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.style.cssText = `
      flex: 1;
      min-height: 48px;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    `;
    copyBtn.onclick = async () => {
      textarea.select();
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(qs);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy to Clipboard';
          }, 2000);
        } catch {
          document.execCommand('copy');
          copyBtn.textContent = 'Copied!';
        }
      } else {
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      width: 70px;
      min-height: 48px;
      background: #475569;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => modal.remove();

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(closeBtn);

    modal.appendChild(title);
    modal.appendChild(textarea);
    modal.appendChild(btnRow);

    document.getElementById('game-container')?.appendChild(modal);
    textarea.select();
  }
}
