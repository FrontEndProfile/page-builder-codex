import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  email = '';
  password = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  async register(): Promise<void> {
    this.loading = true;
    try {
      await this.auth.register(this.email.trim(), this.password);
      this.toast.show('Account created successfully.', 'success');
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.loading = false;
    }
  }

  async goLogin(): Promise<void> {
    await this.router.navigate(['/login']);
  }

  private getErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Registration failed';
    if (message.includes('auth/email-already-in-use')) {
      return 'This email is already registered.';
    }
    if (message.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (message.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (message.includes('auth/operation-not-allowed')) {
      return 'Email/password sign-in is not enabled in Firebase.';
    }
    return message;
  }
}
