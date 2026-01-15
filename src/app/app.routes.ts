import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { BuilderComponent } from './pages/builder/builder.component';
import { PreviewComponent } from './pages/preview/preview.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'builder/:projectId/:pageId', component: BuilderComponent, canActivate: [authGuard] },
  { path: 'preview/:projectId/:pageId', component: PreviewComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'dashboard' },
];
