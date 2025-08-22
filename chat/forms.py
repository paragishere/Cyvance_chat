from django import forms
from django.conf import settings

class TextMessageForm(forms.Form):
    nickname = forms.CharField(max_length=24, required=False)
    content = forms.CharField(widget=forms.Textarea(attrs={'rows':2}), max_length=5000)

class CodeMessageForm(forms.Form):
    nickname = forms.CharField(max_length=24, required=False)
    content = forms.CharField(widget=forms.Textarea(attrs={'rows':6, 'placeholder': 'Paste code here'}), max_length=20000)
    language = forms.CharField(max_length=24, required=False)  # optional for UI hinting

class ImageMessageForm(forms.Form):
    nickname = forms.CharField(max_length=24, required=False)
    image = forms.ImageField()

    def clean_image(self):
        f = self.cleaned_data['image']
        if f.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise forms.ValidationError('Image too large.')
        if getattr(f, 'content_type', None) not in settings.ALLOWED_IMAGE_TYPES:
            raise forms.ValidationError('Unsupported image type.')
        return f
