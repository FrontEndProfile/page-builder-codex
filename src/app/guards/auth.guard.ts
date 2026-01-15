import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return combineLatest([auth.ready$, auth.user$]).pipe(
    filter(([ready]) => ready),
    take(1),
    map(([, user]) => (user ? true : router.createUrlTree(['/login']))),
  );
};
