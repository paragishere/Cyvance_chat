from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('create/', views.create_room, name='create_room'),
    path('r/<str:code>/', views.room_view, name='room'),
    path('api/<str:code>/messages/', views.api_messages, name='api_messages'),
    path('api/<str:code>/send/text/', views.send_text, name='send_text'),
    path('api/<str:code>/send/code/', views.send_code, name='send_code'),
    path('api/<str:code>/send/image/', views.send_image, name='send_image'),
]
