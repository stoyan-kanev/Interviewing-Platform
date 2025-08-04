from django.urls import path
from .views import RegisterView, LoginView, LogoutView, MeView, RefreshAccessTokenView

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('refresh_token/', RefreshAccessTokenView.as_view()),
    path('me/', MeView.as_view()),
]
