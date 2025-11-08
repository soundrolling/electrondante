# Password Reset Email Template

## Use This Template in Supabase

Copy this entire template into: **Supabase Dashboard → Authentication → Email Templates → Reset Password**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Password Reset Request</title>
</head>
<body style="background-color:#f4f4f4;font-family:Arial,sans-serif;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background-color:#fff;border:1px solid #ddd;padding:20px;">
    <h2 style="color:#333;margin-top:0">🔒 Password Reset Requested</h2>
    <p style="color:#555;line-height:1.5">
      You—or someone pretending to be you—requested a password reset for your
      <strong>Soundrolling Pro</strong> account.
    </p>

    <p style="text-align:center;margin:30px 0">
      <a
        href="https://pro.soundrolling.com/auth/set-password?token_hash={{ .TokenHash }}&type=recovery"
        style="display:inline-block;padding:12px 24px;font-size:16px;color:#fff;
               background-color:#007BFF;text-decoration:none;border-radius:4px;"
      >
        Reset My Password
      </a>
    </p>

    <p style="color:#555;line-height:1.5">
      If that button doesn't work, copy and paste the following link into your
      browser:
    </p>
    <p style="word-break:break-all;color:#0066cc;line-height:1.4">
      https://pro.soundrolling.com/auth/set-password?token_hash={{ .TokenHash }}&type=recovery
    </p>

    <p style="color:#555;line-height:1.5">
      If you did not request a password reset, you can safely ignore this email.
      For extra security, you may also log in and change your password.
    </p>

    <p style="color:#555;line-height:1.5;margin-bottom:0">
      Cheers,<br>
      The Soundrolling Pro Team
    </p>
  </div>
</body>
</html>
```

## Why This Template?

**DO NOT use `{{ .ConfirmationURL }}`** - This generates a Supabase verification URL that:
- Goes through Supabase's server first (`/auth/v1/verify`)
- Can expire or fail during verification
- Redirects with error parameters if the token is invalid

**USE `{{ .TokenHash }}`** - This goes directly to your app:
- Bypasses Supabase's verification endpoint
- Goes straight to `/auth/set-password` with the token
- Your app handles verification with better error messages
- More reliable and faster

## Important Notes

1. The URL format is: `https://pro.soundrolling.com/auth/set-password?token_hash={{ .TokenHash }}&type=recovery`
2. The `type=recovery` parameter is required so your app knows it's a password reset
3. Make sure `https://pro.soundrolling.com/auth/set-password` is in your Supabase Redirect URLs
4. The `{{ .TokenHash }}` variable is automatically replaced by Supabase with the actual token

