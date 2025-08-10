import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {InterviewsService} from '../services/interview.service';

@Component({
    selector: 'app-room-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './room-dialog.component.html',
    styleUrls: ['./room-dialog.component.css']
})
export class RoomDialogComponent {
    form: FormGroup;
    loading = false;

    @Input({ required: true }) close!: () => void;
    @Input({ required: true }) onSuccess!: (room: any) => void;

    constructor(
        private fb: FormBuilder,
        private api: InterviewsService,
    ) {
        this.form = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
        });
    }

    create() {
        if (this.form.invalid) return;
        this.loading = true;

        const name = this.form.value.name!.trim();

        this.api.createRoom(name).subscribe({
            next: (room) => {
                this.onSuccess?.(room);
                this.close?.();
            },
            error: (err) => {
                console.error('Failed to create room:', err);
                this.loading = false;
            }
        });
    }
}
