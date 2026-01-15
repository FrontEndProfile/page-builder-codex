import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { BuilderComponent } from './pages/builder/builder.component';
import { PreviewComponent } from './pages/preview/preview.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'builder/:projectId/:pageId', component: BuilderComponent },
  { path: 'preview/:projectId/:pageId', component: PreviewComponent },
  { path: '**', redirectTo: 'dashboard' },
];
