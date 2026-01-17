import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  loadingMessage = 'Signing in...';
  emailError = '';
  passwordError = '';

  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  async login(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      this.emailError = this.email.trim() ? '' : 'Email is required.';
      this.passwordError = this.password ? '' : 'Password is required.';
      this.toast.show('Email and password are required.', 'error');
      return;
    }
    this.emailError = '';
    this.passwordError = '';
    this.loading = true;
    this.loadingMessage = 'Signing in...';
    try {
      await this.auth.login(this.email.trim(), this.password);
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.loading = false;
    }
  }

  async goRegister(): Promise<void> {
    await this.router.navigate(['/register']);
  }

  async logout(): Promise<void> {
    this.loading = true;
    this.loadingMessage = 'Signing out...';
    await this.auth.logout();
    this.loading = false;
  }

  onEmailChange(value: string): void {
    if (value.trim()) {
      this.emailError = '';
    }
  }

  onPasswordChange(value: string): void {
    if (value) {
      this.passwordError = '';
    }
  }

  private getErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Login failed';
    if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
      return 'Incorrect email or password.';
    }
    if (message.includes('auth/user-not-found')) {
      return 'No user found for this email.';
    }
    if (message.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (message.includes('auth/operation-not-allowed')) {
      return 'Email/password sign-in is not enabled in Firebase.';
    }
    return message;
  }
}
