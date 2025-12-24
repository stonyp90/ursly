<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
        ${msg("loginAccountTitle")}
    <#elseif section = "form">
        <div id="kc-form">
            <div id="kc-form-wrapper">
                <#if realm.password>
                    <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                        <div class="form-group">
                            <label for="username" class="form-label">
                                <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
                            </label>
                            <input tabindex="1" id="username" class="form-control" name="username" value="${(login.username!'')}"  type="text" autofocus autocomplete="off"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                   placeholder="<#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>name@company.com<#else>name@company.com</#if>"
                            />
                            <#if messagesPerField.existsError('username','password')>
                                <span class="input-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="form-group">
                            <label for="password" class="form-label">${msg("password")}</label>
                            <div class="password-wrapper">
                                <input tabindex="2" id="password" class="form-control" name="password" type="password" autocomplete="off"
                                       aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                       placeholder="Enter your password"
                                />
                                <button type="button" class="password-toggle" onclick="togglePassword()" tabindex="3">
                                    <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="form-options">
                            <#if realm.rememberMe && !usernameHidden??>
                                <div class="checkbox-wrapper">
                                    <input tabindex="4" id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>>
                                    <label for="rememberMe">${msg("rememberMe")}</label>
                                </div>
                            </#if>
                            <#if realm.resetPasswordAllowed>
                                <a tabindex="5" href="${url.loginResetCredentialsUrl}" class="forgot-password">${msg("doForgotPassword")}</a>
                            </#if>
                        </div>

                        <div class="form-buttons">
                            <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                            <button tabindex="6" class="btn-primary" name="login" id="kc-login" type="submit">
                                ${msg("doLogIn")}
                            </button>
                        </div>
                    </form>
                </#if>
            </div>
        </div>
    <#elseif section = "socialProviders">
        <#if realm.password && social.providers??>
            <div id="kc-social-providers" class="social-providers">
                <div class="social-divider">
                    <span>or continue with</span>
                </div>
                <ul class="social-links">
                    <#list social.providers as p>
                        <li>
                            <div id="social-${p.alias}" class="social-link social-link-${p.alias} social-link-disabled" 
                               title="Feature under development">
                                <#if p.alias == "google">
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    <span>Google</span>
                                <#elseif p.alias == "microsoft">
                                    <svg width="20" height="20" viewBox="0 0 23 23">
                                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                                    </svg>
                                    <span>Microsoft</span>
                                <#elseif p.alias == "adobe">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                                        <path d="M13.966 22.624l-1.69-4.281H8.122l3.892-9.144 5.662 13.425h-3.71zm.893-16.994L18.5 0h-7.258l7.617 22.624h4.14L13.966 5.63h.893zM5.5 0L0 22.624h4.009l1.376-3.518h4.065L5.5 0z"/>
                                    </svg>
                                    <span>Adobe</span>
                                <#elseif p.alias == "github">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                    <span>GitHub</span>
                                <#else>
                                    <span class="social-icon">${p.displayName!}</span>
                                    <span>${p.displayName!}</span>
                                </#if>
                                <span class="coming-soon-badge">Coming Soon</span>
                            </div>
                        </li>
                    </#list>
                </ul>
            </div>
        </#if>
    <#elseif section = "info">
        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <div id="kc-registration-container">
                <div id="kc-registration">
                    <span>${msg("noAccount")} <a tabindex="7" href="${url.registrationUrl}">${msg("doRegister")}</a></span>
                </div>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>

<div id="idp-confirm-modal" class="idp-modal" style="display: none;">
    <div class="idp-modal-backdrop" onclick="closeIdpModal()"></div>
    <div class="idp-modal-content">
        <h3>Continue with <span id="idp-provider-name"></span>?</h3>
        <p>You'll be redirected to sign in with your <span id="idp-provider-name2"></span> account.</p>
        <div class="idp-modal-buttons">
            <button type="button" class="btn-secondary" onclick="closeIdpModal()">Cancel</button>
            <a id="idp-confirm-link" href="#" class="btn-primary">Continue</a>
        </div>
    </div>
</div>

<style>
.idp-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}
.idp-modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
}
.idp-modal-content {
    position: relative;
    background: var(--ursly-surface, #1a1a2e);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 16px;
    padding: 32px;
    max-width: 400px;
    width: 90%;
    text-align: center;
    animation: modalFadeIn 0.2s ease-out;
}
@keyframes modalFadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
.idp-modal-content h3 {
    color: var(--ursly-text, #e2e8f0);
    margin-bottom: 12px;
    font-size: 1.25rem;
}
.idp-modal-content p {
    color: var(--ursly-text-muted, #94a3b8);
    margin-bottom: 24px;
    font-size: 0.9rem;
}
.idp-modal-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
}
.idp-modal-buttons .btn-secondary {
    flex: 1;
    margin-top: 0;
}
.idp-modal-buttons .btn-primary {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
}
</style>

<script>
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

function showIdpConfirm(event, providerName, loginUrl) {
    event.preventDefault();
    document.getElementById('idp-provider-name').textContent = providerName;
    document.getElementById('idp-provider-name2').textContent = providerName;
    document.getElementById('idp-confirm-link').href = loginUrl;
    document.getElementById('idp-confirm-modal').style.display = 'flex';
}

function closeIdpModal() {
    document.getElementById('idp-confirm-modal').style.display = 'none';
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeIdpModal();
});
</script>

