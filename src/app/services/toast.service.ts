import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastMessage {
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastSubject = new BehaviorSubject<ToastMessage | null>(null);

  toast$ = this.toastSubject.asObservable();

  show(message: string, type: ToastType = 'info'): void {
    this.toastSubject.next({ message, type });
  }

  clear(): void {
    this.toastSubject.next(null);
  }
}
