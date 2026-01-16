import { Injectable } from '@angular/core';
import { getDownloadURL, getStorage, listAll, ref, uploadBytes } from 'firebase/storage';
import { firebaseApp } from '../firebase/firebase-init';
import { AuthService } from './auth.service';
import { generateId } from '../utils/page-builder-utils';

@Injectable({ providedIn: 'root' })
export class FirebaseStorageService {
  private storage = getStorage(firebaseApp);

  constructor(private auth: AuthService) {}

  async uploadImage(projectId: string, file: File): Promise<string> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }
    const path = `users/${uid}/projects/${projectId}/images/${generateId()}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async listProjectImages(projectId: string): Promise<string[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }
    const folderRef = ref(this.storage, `users/${uid}/projects/${projectId}/images`);
    const result = await listAll(folderRef);
    return Promise.all(result.items.map((item) => getDownloadURL(item)));
  }
}
