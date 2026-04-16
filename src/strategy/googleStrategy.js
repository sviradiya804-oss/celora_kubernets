const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Validate Google OAuth environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
  console.error('❌ Missing Google OAuth environment variables');
  process.exit(1);
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔍 Google OAuth profile:', profile.id, profile.emails[0].value);
        
        const email = profile.emails[0].value;
        const name = profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim();

        // Check by email (not googleId only)
        let user = await User.findOne({ email });

        if (!user) {
          console.log('👤 Creating new user from Google OAuth');
          user = await User.create({
            email,
            name: name || email.split('@')[0], // Use email prefix if no name
            googleId: profile.id,
            isVerified: true // Google accounts are pre-verified
          });
        } else if (!user.googleId) {
          console.log('🔗 Linking existing user with Google OAuth');
          user.googleId = profile.id;
          user.isVerified = true; // Mark as verified since they used Google
          await user.save();
        }

        console.log('✅ Google OAuth successful for user:', user.email);
        done(null, user);
      } catch (err) {
        console.error('❌ Google OAuth error:', err);
        done(err, null);
      }
    }
  )
);
