from django.conf import settings
from django.db import models
from django.contrib.auth.models import User


class InterviewNote(models.Model):
    room_id = models.CharField(max_length=255, db_index=True)
    interviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    candidate_name = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('room_id', 'interviewer')
        ordering = ['-updated_at']

    def __str__(self):
        return f"Notes for {self.candidate_name} - {self.room_id[:8]}"