import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Smartphone, Lock, Eye, EyeOff } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});

  const validate = () => {
    const e: { mobile?: string; password?: string } = {};
    if (!mobile.trim()) e.mobile = "Mobile number is required";
    else if (!/^\d{7,15}$/.test(mobile.trim())) e.mobile = "Enter a valid mobile number";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Minimum 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Step 1: Look up the user's email by mobile_number in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('mobile_number', mobile.trim())
        .single();

      if (userError || !userData) {
        Alert.alert("Login Failed", "Invalid mobile number or password");
        return;
      }

      // Step 2: Sign in with the email from the users table
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password,
      });

      if (authError) {
        Alert.alert("Login Failed", "Invalid mobile number or password");
      }
      // On success, AuthContext listener auto-redirects to home
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top branding */}
          <View style={styles.brandingContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>J</Text>
            </View>
            <Text style={styles.appName}>JBS Marketing</Text>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>BUSINESS PORTAL</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>

          {/* White card */}
          <View style={styles.card}>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to manage your business</Text>

            {/* Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={[styles.inputRow, errors.mobile ? styles.inputError : styles.inputNormal]}>
                <Smartphone size={18} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 0771234567"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  value={mobile}
                  onChangeText={(t) => {
                    setMobile(t);
                    setErrors((e) => ({ ...e, mobile: undefined }));
                  }}
                />
              </View>
              {errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputRow, errors.password ? styles.inputError : styles.inputNormal]}>
                <Lock size={18} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setErrors((e) => ({ ...e, password: undefined }));
                  }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  {showPassword ? (
                    <EyeOff size={18} color="#6b7280" />
                  ) : (
                    <Eye size={18} color="#6b7280" />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerFull}>
              <View style={styles.dividerLineDark} />
              <Text style={styles.dividerMidText}>AUTHORIZED USERS ONLY</Text>
              <View style={styles.dividerLineDark} />
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Need access? </Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Contact Administrator</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PRIMARY = "#4338ca";
const PRIMARY_DARK = "#3730a3";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PRIMARY },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Branding
  brandingContainer: { alignItems: "center", paddingTop: 56, paddingBottom: 48, paddingHorizontal: 24 },
  logoBox: {
    width: 96, height: 96, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  logoLetter: { color: "#fff", fontSize: 48, fontWeight: "bold" },
  appName: { color: "#fff", fontSize: 28, fontWeight: "bold", letterSpacing: 1.5 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  dividerLine: { height: 1, width: 40, backgroundColor: "rgba(255,255,255,0.3)" },
  dividerText: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginHorizontal: 12, letterSpacing: 2 },

  // Card
  card: {
    flex: 1, backgroundColor: "#fff",
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
  },
  welcomeTitle: { color: "#111827", fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  welcomeSubtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 32 },

  // Fields
  fieldGroup: { marginBottom: 20 },
  label: { color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f9fafb", borderWidth: 1,
    borderRadius: 16, paddingHorizontal: 14,
  },
  inputNormal: { borderColor: "#e5e7eb" },
  inputError: { borderColor: "#f87171" },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#1f2937", fontSize: 15, paddingVertical: 14 },
  eyeBtn: { paddingLeft: 8, paddingVertical: 14 },
  errorText: { color: "#ef4444", fontSize: 12, marginTop: 6, marginLeft: 4 },

  // Button
  loginBtn: {
    backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 16, alignItems: "center", marginTop: 8,
  },
  loginBtnDisabled: { backgroundColor: PRIMARY_DARK, opacity: 0.7 },
  loginBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15, letterSpacing: 0.5 },

  // Footer
  dividerFull: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  dividerLineDark: { flex: 1, height: 1, backgroundColor: "#f3f4f6" },
  dividerMidText: { color: "#d1d5db", fontSize: 11, marginHorizontal: 12, letterSpacing: 1.5 },
  footerRow: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: "#9ca3af", fontSize: 14 },
  footerLink: { color: PRIMARY, fontSize: 14, fontWeight: "600" },
});
