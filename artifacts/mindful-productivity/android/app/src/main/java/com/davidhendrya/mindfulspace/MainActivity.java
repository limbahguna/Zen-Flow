package com.davidhendrya.mindfulspace;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewParent;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int APP_BACKGROUND = Color.rgb(20, 24, 20);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        getApplication().setTheme(R.style.AppTheme_NoActionBar);
        setTheme(R.style.AppTheme_NoActionBar);

        Window window = getWindow();
        window.setStatusBarColor(APP_BACKGROUND);
        window.setNavigationBarColor(APP_BACKGROUND);
        window.getDecorView().setBackgroundColor(APP_BACKGROUND);

        super.onCreate(savedInstanceState);

        View decorView = window.getDecorView();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            // Android 15+ enforces edge-to-edge for this target SDK. The bars
            // must be transparent so the dark native window underneath shows.
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        } else {
            window.setStatusBarColor(APP_BACKGROUND);
            window.setNavigationBarColor(APP_BACKGROUND);
        }

        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(window, decorView);
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        decorView.setBackgroundColor(APP_BACKGROUND);
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(APP_BACKGROUND);
        }

        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(APP_BACKGROUND);
        ViewParent parent = webView.getParent();
        while (parent instanceof View) {
            ((View) parent).setBackgroundColor(APP_BACKGROUND);
            parent = parent.getParent();
        }

        // Keep normal taps, focus, and the soft keyboard, but suppress Android's
        // floating text-selection panel on long press inside the app WebView.
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(view -> true);
    }
}
