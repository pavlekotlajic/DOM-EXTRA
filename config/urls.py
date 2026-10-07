from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from shop import views

urlpatterns = [
    path('', views.frontend_page('index.html')),
    path('web-shop/', views.frontend_page('web-shop.html')),
    path('web-shop', views.frontend_page('web-shop.html')),
    path('b2b/', views.frontend_page('b2b.html')),
    path('b2b', views.frontend_page('b2b.html')),
    path('admin/', views.frontend_page('admin.html')),
    path('admin', views.frontend_page('admin.html')),
    path('administracija/', views.frontend_page('admin.html')),
    path('kontakt/', views.frontend_page('kontakt.html')),
    path('kontakt', views.frontend_page('kontakt.html')),
    path('o-nama/', views.frontend_page('o-nama.html')),
    path('o-nama', views.frontend_page('o-nama.html')),
    path('api/<path:subpath>', views.api_dispatch),
    path('api/', views.api_dispatch),
    re_path(r'^(?P<filepath>assets/.*)$', views.frontend_file),
    re_path(r'^(?P<filepath>favicon\.svg|robots\.txt|sitemap\.xml)$', views.frontend_file),
    # stari .html URL-ovi -> pravi Django URL-ovi
    path('index.html', views.redirect_home),
    path('web-shop.html', views.redirect_shop),
    path('b2b.html', views.redirect_b2b),
    path('admin.html', views.redirect_admin),
    path('kontakt.html', views.redirect_kontakt),
    path('o-nama.html', views.redirect_onama),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
