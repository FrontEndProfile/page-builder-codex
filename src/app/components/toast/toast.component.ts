import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';
import { ToastMessage, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent implements OnInit, OnDestroy {
  toast: ToastMessage | null = null;
  private sub?: Subscription;
  private hideSub?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toast$.subscribe((toast) => {
      this.toast = toast;
      this.hideSub?.unsubscribe();
      if (toast) {
        this.hideSub = timer(3500).subscribe(() => this.toastService.clear());
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.hideSub?.unsubscribe();
  }

  close(): void {
    this.toastService.clear();
  }
}
