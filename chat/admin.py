from django.contrib import admin
from .models import Room, Message

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('code', 'created_at', 'last_activity')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('room', 'msg_type', 'nickname', 'created_at')
