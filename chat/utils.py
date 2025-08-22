import secrets
import string
from django.utils import timezone
from django.conf import settings
from .models import Room, Message

def random_code(length=8):
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def create_unique_room_code():
    for _ in range(10):
        code = random_code(8)
        if not Room.objects.filter(code=code).exists():
            return code
    return random_code(10)

def purge_expired_rooms():
    cutoff = timezone.now() - timezone.timedelta(minutes=settings.EPHEMERAL_ROOM_IDLE_MINUTES)
    qs = Room.objects.filter(last_activity__lt=cutoff)
    # Delete related images in storage as well
    for room in qs:
        for msg in room.messages.all():
            if msg.image:
                msg.image.delete(save=False)
        room.delete()
