import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseApp } from '../firebase/firebase-init';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = getAuth(firebaseApp);
  private userSubject = new BehaviorSubject<User | null>(null);
  private readySubject = new BehaviorSubject<boolean>(false);

  user$ = this.userSubject.asObservable();
  ready$ = this.readySubject.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
      this.readySubject.next(true);
    });
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
