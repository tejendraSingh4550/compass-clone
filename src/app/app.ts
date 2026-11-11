import { Component, signal } from '@angular/core';

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly ticks = Array.from({ length: 72 }, (_, index) => index);
  protected readonly heading = signal(0);
  protected readonly sensorActive = signal(false);
  protected readonly manualMode = signal(false);
  protected readonly sensorMessage = signal('Tap below to use your device’s compass.');
  protected readonly coordinates = signal('Location not set');
  protected readonly locationMessage = signal('Your location stays on this device.');
  protected readonly locationActive = signal(false);
  private orientationHandler?: (event: DeviceOrientationEvent) => void;
  private dragging = false;

  protected get direction(): string {
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(this.heading() / 45) % 8];
  }

  protected get directionName(): string {
    return ({ N: 'North', NE: 'North-east', E: 'East', SE: 'South-east', S: 'South', SW: 'South-west', W: 'West', NW: 'North-west' })[this.direction] ?? 'North';
  }

  protected async enableCompass(): Promise<void> {
    this.manualMode.set(false);
    if (!('DeviceOrientationEvent' in window)) {
      this.sensorMessage.set('This device does not provide a compass sensor. Try opening Compass on a phone.');
      return;
    }
    const Orientation = DeviceOrientationEvent as OrientationPermission;
    if (Orientation.requestPermission) {
      try {
        if (await Orientation.requestPermission() !== 'granted') {
          this.sensorMessage.set('Compass access was not allowed. You can enable it in your browser settings.');
          return;
        }
      } catch {
        this.sensorMessage.set('Compass access could not be started. Please try again.');
        return;
      }
    }

    this.orientationHandler = (event: DeviceOrientationEvent) => {
      const compassEvent = event as CompassEvent;
      const value = compassEvent.webkitCompassHeading ?? (event.alpha === null ? null : 360 - event.alpha);
      if (value !== null && Number.isFinite(value)) {
        this.heading.set(Math.round((value + 360) % 360));
        this.sensorActive.set(true);
        this.sensorMessage.set('Compass is active. Move your phone to change direction.');
      }
    };
    window.addEventListener('deviceorientation', this.orientationHandler, true);
    window.addEventListener('deviceorientationabsolute', this.orientationHandler, true);
    this.sensorMessage.set('Waiting for your device’s compass sensor…');
  }

  protected locate(): void {
    if (!navigator.geolocation) {
      this.locationMessage.set('Location is not available in this browser.');
      return;
    }
    this.locationMessage.set('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        this.coordinates.set(`${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`);
        this.locationActive.set(true);
        this.locationMessage.set(`Accurate to about ${Math.round(accuracy)} metres`);
      },
      error => {
        this.locationMessage.set(error.code === error.PERMISSION_DENIED ? 'Location access was denied. Allow it in your browser settings.' : 'Couldn’t find your location. Check your connection and try again.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  protected calibrate(): void {
    this.sensorMessage.set('Move your device slowly in a figure-eight to calibrate the compass.');
  }

  protected startDialDrag(event: PointerEvent): void {
    this.dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.moveDial(event);
  }

  protected continueDialDrag(event: PointerEvent): void {
    if (this.dragging) this.moveDial(event);
  }

  protected stopDialDrag(): void { this.dragging = false; }

  protected moveWithKeyboard(event: KeyboardEvent): void {
    const steps: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    this.setManualHeading(this.heading() + step);
  }

  private moveDial(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    this.setManualHeading(Math.atan2(dx, -dy) * 180 / Math.PI);
  }

  private setManualHeading(value: number): void {
    this.heading.set(Math.round((value + 360) % 360));
    this.manualMode.set(true);
    this.sensorMessage.set('Manual preview · drag the dial or use your arrow keys.');
  }
}
