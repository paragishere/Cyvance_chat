from django.db import models
from django.utils import timezone

class Room(models.Model):
    code = models.CharField(max_length=12, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now_add=True)

    def touch(self):
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])

class Message(models.Model):
    MESSAGE_TYPES = (
        ('text', 'Text'),
        ('code', 'Code'),
        ('image', 'Image'),
    )
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='messages')
    msg_type = models.CharField(max_length=10, choices=MESSAGE_TYPES)
    content = models.TextField(blank=True)   # For text/code
    image = models.ImageField(upload_to='room_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    nickname = models.CharField(max_length=24, default='anon')

    class Meta:
        ordering = ['created_at']
