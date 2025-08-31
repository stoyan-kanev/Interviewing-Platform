import uuid

from django.db import models

from user.models import User


# Create your models here.

class Room(models.Model):
    id = models.BigAutoField(primary_key=True)
    room_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="rooms", db_index=True)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="unique_room_name_per_owner")
        ]
        ordering = ["-id"]

    def __str__(self):
        return self.name