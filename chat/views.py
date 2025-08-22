from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.conf import settings

from .models import Room, Message
from .forms import TextMessageForm, CodeMessageForm, ImageMessageForm
from .utils import create_unique_room_code, purge_expired_rooms

def home(request):
    purge_expired_rooms()
    return render(request, 'chat/create.html')

@require_POST
def create_room(request):
    purge_expired_rooms()
    code = create_unique_room_code()
    room = Room.objects.create(code=code)
    return redirect('room', code=room.code)

def room_view(request, code):
    purge_expired_rooms()
    room = get_object_or_404(Room, code=code)
    room.touch()
    return render(request, 'chat/room.html', {
        'room': room,
        'text_form': TextMessageForm(),
        'code_form': CodeMessageForm(),
        'image_form': ImageMessageForm(),
        'expiry_minutes': settings.EPHEMERAL_ROOM_IDLE_MINUTES,
    })

def api_messages(request, code):
    purge_expired_rooms()
    room = get_object_or_404(Room, code=code)
    since = request.GET.get('since')
    qs = room.messages.all()
    if since:
        try:
            ts = timezone.datetime.fromisoformat(since.replace('Z','+00:00'))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            qs = qs.filter(created_at__gt=ts)
        except Exception:
            return HttpResponseBadRequest('Invalid since')
    data = []
    for m in qs:
        data.append({
            'id': m.id,
            'type': m.msg_type,
            'content': m.content,
            'image_url': m.image.url if m.image else None,
            'created_at': m.created_at.isoformat(),
            'nickname': m.nickname,
        })
    return JsonResponse({
        'messages': data,
        'server_time': timezone.now().isoformat(),
        'expires_at': (room.last_activity + timezone.timedelta(minutes=settings.EPHEMERAL_ROOM_IDLE_MINUTES)).isoformat()
    })

    

@require_POST
def send_text(request, code):
    purge_expired_rooms()
    room = get_object_or_404(Room, code=code)
    form = TextMessageForm(request.POST)
    if form.is_valid():
        Message.objects.create(
            room=room,
            msg_type='text',
            content=form.cleaned_data['content'],
            nickname=form.cleaned_data.get('nickname') or 'anon'
        )
        room.touch()
        return JsonResponse({'ok': True})
    return JsonResponse({'ok': False, 'errors': form.errors}, status=400)

@require_POST
def send_code(request, code):
    purge_expired_rooms()
    room = get_object_or_404(Room, code=code)
    form = CodeMessageForm(request.POST)
    if form.is_valid():
        content = form.cleaned_data['content']
        lang = form.cleaned_data.get('language')
        if lang:
            content = f"[{lang}]\n{content}"
        Message.objects.create(
            room=room,
            msg_type='code',
            content=content,
            nickname=form.cleaned_data.get('nickname') or 'anon'
        )
        room.touch()
        return JsonResponse({'ok': True})
    return JsonResponse({'ok': False, 'errors': form.errors}, status=400)

@require_POST
def send_image(request, code):
    purge_expired_rooms()
    room = get_object_or_404(Room, code=code)
    form = ImageMessageForm(request.POST, request.FILES)
    if form.is_valid():
        Message.objects.create(
            room=room,
            msg_type='image',
            image=form.cleaned_data['image'],
            nickname=form.cleaned_data.get('nickname') or 'anon'
        )
        room.touch()
        return JsonResponse({'ok': True})
    return JsonResponse({'ok': False, 'errors': form.errors}, status=400)


