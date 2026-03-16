// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// ==========================================
// 🔴 ATENÇÃO DESENVOLVEDOR 🔴
// Cole aqui as configurações do seu projeto Firebase.
// 1. Crie um projeto no Firebase Console (https://console.firebase.google.com/)
// 2. Vá em Authentication > Get Started
// 3. Ative os provedores "Google" e "E-mail/senha"
// 4. Vá em Project Settings > Add App (Web) > Copie o objeto firebaseConfig
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDwc9aD8-RXBLwReyokwtgqIhujO0MXMX0",
  authDomain: "dashboard-e228e.firebaseapp.com",
  projectId: "dashboard-e228e",
  storageBucket: "dashboard-e228e.firebasestorage.app",
  messagingSenderId: "209393768051",
  appId: "1:209393768051:web:739991b5e612b9a4927c06",
  measurementId: "G-3QCBLW197L"
};

// Verifica se o Firebase foi configurado
const isFirebaseConfigured = firebaseConfig.apiKey !== "";

let app, auth, provider;

if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
}

// Lógica de UI para a página de Login
const isLoginPage = window.location.pathname.includes('login.html');

if (isLoginPage) {
    // Referências DOM
    const authForm = document.getElementById('auth-form');
    const toggleAuthBtn = document.getElementById('toggle-auth');
    const toggleText = document.getElementById('toggle-text');
    const nameField = document.getElementById('name-field');
    const submitBtnText = document.getElementById('submit-text');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const errorMsg = document.getElementById('error-msg');
    const firebaseWarning = document.getElementById('firebase-warning');

    let isRegistering = false;

    // Se o Dev não configurou as chaves, mostrar aviso
    if (!isFirebaseConfigured && firebaseWarning) {
        firebaseWarning.classList.remove('hidden');
    }

    // Função de erro estético
    const showError = (msg) => {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
        setTimeout(() => errorMsg.classList.add('hidden'), 5000);
    };

    // Alternar entre Login <-> Cadastro
    toggleAuthBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isRegistering = !isRegistering;
        
        if (isRegistering) {
            nameField.classList.remove('hidden', 'max-h-0', 'opacity-0');
            nameField.classList.add('max-h-24', 'opacity-100');
            submitBtnText.textContent = 'Cadastrar';
            toggleText.textContent = 'Já tem uma conta?';
            toggleAuthBtn.textContent = 'Faça Login';
        } else {
            nameField.classList.add('hidden', 'max-h-0', 'opacity-0');
            nameField.classList.remove('max-h-24', 'opacity-100');
            submitBtnText.textContent = 'Entrar';
            toggleText.textContent = 'Não tem uma conta?';
            toggleAuthBtn.textContent = 'Cadastre-se';
        }
    });

    // Submissão do Formulário de Email/Senha
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isFirebaseConfigured) {
            showError("Erro: Configure o Firebase no arquivo auth.js");
            return;
        }

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;

        try {
            submitBtnText.textContent = 'Aguarde...';
            
            if (isRegistering) {
                // Registrar
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (name) {
                    await updateProfile(userCredential.user, { displayName: name });
                }
            } else {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
            }
            // O onAuthStateChanged lidará com o redirecionamento
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                showError("Este email já está cadastrado.");
            } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                showError("Email ou senha incorretos.");
            } else if (error.code === 'auth/weak-password') {
                showError("A senha deve ter pelo menos 6 caracteres.");
            } else {
                showError("Erro na autenticação. Tente novamente.");
            }
            submitBtnText.textContent = isRegistering ? 'Cadastrar' : 'Entrar';
        }
    });

    // Login com Google
    googleLoginBtn.addEventListener('click', async () => {
        if (!isFirebaseConfigured) {
            showError("Erro: Configure o Firebase no arquivo auth.js");
            return;
        }

        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Erro completo do Google Sign-In: ", error);
            if (error.code === 'auth/popup-closed-by-user') {
                showError("Pop-up fechado antes da conclusão.");
            } else if (error.code === 'auth/cancelled-popup-request') {
                showError("Múltiplos pop-ups abertos.");
            } else {
                // Ao invez de uma mensagem generica, vamos mostrar exatemente qual é o problema.
                showError(`Erro: ${error.message}`);
            }
        }
    });
}

// Guardão de Rotas (Auth Guard)
// Redireciona usuários não logados e controla a sessão global
if (isFirebaseConfigured) {
    onAuthStateChanged(auth, (user) => {
        const isLoginPage = window.location.pathname.includes('login');
        
        if (user) {
            // Usuário logado
            if (isLoginPage) {
                // Se está na tela de login e logou, vai pro painel
                window.location.href = '/';
            } else {
                console.log("Usuário Autenticado: ", user.email);
                
                // Exibir perfil na UI se existir
                const userNameEl = document.getElementById('user-name');
                const userProfileWidget = document.getElementById('user-profile-widget');
                const userInitial = document.getElementById('user-initial');
                
                if (userNameEl) {
                    const nameToDisplay = user.displayName || user.email.split('@')[0];
                    userNameEl.textContent = nameToDisplay;
                    if(userInitial) userInitial.textContent = nameToDisplay.charAt(0).toUpperCase();
                }
                if (userProfileWidget) userProfileWidget.classList.remove('hidden');
                if (userProfileWidget) userProfileWidget.classList.add('flex');
            }
        } else {
            // Usuário Deslogado
            if (!isLoginPage) {
                // Se NÃO estiver no login, chutar pra tela de login
                window.location.href = 'login.html';
            }
        }
    });
}

// Função de logout global (acessível do window para uso fácil no HTML)
window.logoutApp = () => {
    if (auth) {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch(err => console.error("Erro ao sair", err));
    }
};
