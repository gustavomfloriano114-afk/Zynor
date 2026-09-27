const SUPABASE_URL =
    "https://dazwnwkkszydyrcoajll.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_q87setC5fqkaVhHRWdlabw_UWNav-5H";

const ZYNOR_API_URL =
    "https://dazwnwkkszydyrcoajll.supabase.co/functions/v1/hyper-endpoint";

const TAMANHO_MAXIMO_IMAGEM = 8 * 1024 * 1024; // 8MB

const Zynor = {
    name: "Zynor",
    version: "1.1.0",
    model: "definido no backend",
    storageKey: "zynor_data",
    personality: `
Você é a Zynor, uma inteligência artificial amigável,
útil, direta e inteligente.

Responda em português do Brasil quando o usuário falar
em português.

Não invente informações.

Se não souber alguma coisa, diga claramente que não sabe.

Explique assuntos difíceis de maneira simples.

Não seja excessivamente formal.

Evite respostas enormes quando uma resposta curta resolver.

Quando o usuário pedir código, entregue código funcional
e explique somente o necessário.

Quando o usuário pedir ajuda passo a passo,
explique em etapas simples.

Não fique repetindo a mesma informação.

Seu objetivo é ajudar o usuário de forma prática.
`
};

let supabaseClient = null;

try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );
    }
} catch (erro) {
    console.error("Erro ao criar cliente Supabase:", erro);
}

let database = {
    conversations: [],
    currentConversation: null
};

let currentUser = null;
let selectedImage = null;
let isSending = false;
let authMode = "login";
let currentAbortController = null;

const app = document.getElementById("app");
const authScreen = document.getElementById("authScreen");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const recoveryForm = document.getElementById("recoveryForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const passwordStrength = document.getElementById("passwordStrength");
const signupButton = document.getElementById("signupButton");
const signupMessage = document.getElementById("signupMessage");
const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const recoveryPassword = document.getElementById("recoveryPassword");
const recoveryButton = document.getElementById("recoveryButton");
const recoveryMessage = document.getElementById("recoveryMessage");

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarButton = document.getElementById("openSidebar");
const closeSidebarButton = document.getElementById("closeSidebar");

const chat = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const stopButton = document.getElementById("stopButton");
const newChat = document.getElementById("newChat");
const conversationList = document.getElementById("conversationList");

const settingsBtn = document.getElementById("settingsBtn");
const aboutBtn = document.getElementById("aboutBtn");

const statusText = document.getElementById("statusText");
const connectionBanner = document.getElementById("connectionBanner");

const imageButton = document.getElementById("imageButton");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const previewImage = document.getElementById("previewImage");
const removeImage = document.getElementById("removeImage");

const userProfile = document.getElementById("userProfile");
const userProfileButton = document.getElementById("userProfileButton");
const profileMenu = document.getElementById("profileMenu");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const profileSettings = document.getElementById("profileSettings");
const logoutButton = document.getElementById("logoutButton");


/* =====================================================
   UTILITÁRIOS
===================================================== */

function mostrarElemento(elemento) {
    if (!elemento) return;
    elemento.classList.remove("hidden");
}

function esconderElemento(elemento) {
    if (!elemento) return;
    elemento.classList.add("hidden");
}


/* =====================================================
   LOCAL STORAGE
===================================================== */

function salvarLocal() {
    try {
        localStorage.setItem(Zynor.storageKey, JSON.stringify(database));
    } catch (erro) {
        console.warn("Não foi possível salvar localmente:", erro);
    }
}

function carregarLocal() {
    try {
        const salvo = localStorage.getItem(Zynor.storageKey);
        if (!salvo) return;
        const dados = JSON.parse(salvo);
        if (dados && Array.isArray(dados.conversations)) {
            database = dados;
        }
    } catch (erro) {
        console.warn("Erro ao carregar dados locais:", erro);
    }
}


/* =====================================================
   CONEXÃO (online / offline)
===================================================== */

function atualizarConexao() {

    if (navigator.onLine) {
        esconderElemento(connectionBanner);
    } else {
        mostrarElemento(connectionBanner);
    }

}

window.addEventListener("online", atualizarConexao);
window.addEventListener("offline", atualizarConexao);


/* =====================================================
   AUTH
===================================================== */

function showAuth() {
    esconderElemento(app);
    mostrarElemento(authScreen);
}

function showApp() {
    esconderElemento(authScreen);
    mostrarElemento(app);
}

function limparMensagemAuth() {
    if (loginMessage) loginMessage.textContent = "";
    if (signupMessage) signupMessage.textContent = "";
    if (recoveryMessage) recoveryMessage.textContent = "";
}

function mostrarErroAuth(mensagem) {
    if (authMode === "login") {
        if (loginMessage) loginMessage.textContent = mensagem || "";
    } else if (authMode === "signup") {
        if (signupMessage) signupMessage.textContent = mensagem || "";
    } else if (authMode === "recovery") {
        if (recoveryMessage) recoveryMessage.textContent = mensagem || "";
    }
}

function setAuthMode(modo) {
    authMode = modo;
    limparMensagemAuth();

    esconderElemento(loginForm);
    esconderElemento(signupForm);
    esconderElemento(recoveryForm);

    if (modo === "signup") {
        mostrarElemento(signupForm);
        setTimeout(() => signupName?.focus(), 100);
    } else if (modo === "recovery") {
        mostrarElemento(recoveryForm);
        setTimeout(() => recoveryPassword?.focus(), 100);
    } else {
        mostrarElemento(loginForm);
        setTimeout(() => loginEmail?.focus(), 100);
    }
}

function traduzirErroAuth(erro) {
    const mensagem = String(erro?.message || "").toLowerCase();

    if (mensagem.includes("invalid login credentials")) {
        return "E-mail ou senha incorretos.";
    }
    if (mensagem.includes("email not confirmed")) {
        return "Confirme seu e-mail antes de entrar.";
    }
    if (mensagem.includes("user already registered")) {
        return "Este e-mail já possui uma conta.";
    }
    if (mensagem.includes("password should be at least")) {
        return "A senha precisa ter pelo menos 6 caracteres.";
    }
    if (mensagem.includes("invalid email")) {
        return "Digite um e-mail válido.";
    }
    if (mensagem.includes("rate limit")) {
        return "Muitas tentativas. Aguarde um pouco.";
    }
    if (mensagem.includes("same password")) {
        return "A nova senha precisa ser diferente da anterior.";
    }

    return erro?.message || "Não foi possível realizar a operação.";
}


/* =====================================================
   FORÇA DE SENHA
===================================================== */

function avaliarForcaSenha(senha) {
    if (!senha) return { percentual: "0%", cor: "#ff5d5d" };

    let pontos = 0;

    if (senha.length >= 6) pontos++;
    if (senha.length >= 10) pontos++;
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
    if (/[0-9]/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;

    const niveis = [
        { percentual: "20%", cor: "#ff5d5d" },
        { percentual: "40%", cor: "#ff9d4d" },
        { percentual: "60%", cor: "#ffd24d" },
        { percentual: "80%", cor: "#9fe04d" },
        { percentual: "100%", cor: "#37d39b" }
    ];

    return niveis[Math.max(0, Math.min(pontos, niveis.length) - 1)];
}

function atualizarIndicadorSenha() {
    if (!passwordStrength || !signupPassword) return;

    const senha = signupPassword.value;

    if (!senha) {
        passwordStrength.style.setProperty("--strength", "0%");
        return;
    }

    const nivel = avaliarForcaSenha(senha);

    passwordStrength.style.setProperty("--strength", nivel.percentual);
    passwordStrength.style.setProperty("--strength-color", nivel.cor);
}


/* =====================================================
   CADASTRO
===================================================== */

async function signUp() {
    if (!supabaseClient) {
        mostrarErroAuth("O sistema de contas não foi carregado.");
        return;
    }

    const nome = signupName?.value.trim() || "";
    const email = signupEmail?.value.trim() || "";
    const senha = signupPassword?.value || "";

    if (!nome) {
        mostrarErroAuth("Digite seu nome.");
        return;
    }
    if (!email) {
        mostrarErroAuth("Digite seu e-mail.");
        return;
    }
    if (senha.length < 6) {
        mostrarErroAuth("A senha precisa ter pelo menos 6 caracteres.");
        return;
    }

    limparMensagemAuth();

    if (signupButton) {
        signupButton.disabled = true;
        signupButton.textContent = "Criando conta...";
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password: senha,
            options: { data: { name: nome } }
        });

        if (error) throw error;

        if (!data.session) {
            if (signupMessage) {
                signupMessage.textContent =
                    "Conta criada! Verifique seu e-mail para confirmar a conta e depois entre.";
            }
            return;
        }

        currentUser = data.user;
        await iniciarAplicacao(data.user);
    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        mostrarErroAuth(traduzirErroAuth(erro));
    } finally {
        if (signupButton) {
            signupButton.disabled = false;
            signupButton.textContent = "Criar conta";
        }
    }
}


/* =====================================================
   LOGIN
===================================================== */

async function signIn() {
    if (!supabaseClient) {
        mostrarErroAuth("O sistema de contas não foi carregado.");
        return;
    }

    const email = loginEmail?.value.trim() || "";
    const senha = loginPassword?.value || "";

    if (!email) {
        mostrarErroAuth("Digite seu e-mail.");
        return;
    }
    if (!senha) {
        mostrarErroAuth("Digite sua senha.");
        return;
    }

    limparMensagemAuth();

    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "Entrando...";
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password: senha
        });

        if (error) throw error;

        currentUser = data.user;
        await iniciarAplicacao(data.user);
    } catch (erro) {
        console.error("Erro no login:", erro);
        mostrarErroAuth(traduzirErroAuth(erro));
    } finally {
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = "Entrar";
        }
    }
}


/* =====================================================
   RECUPERAÇÃO DE SENHA

   Fluxo:
   1. Usuário clica "Esqueci minha senha" na tela de login.
   2. Supabase envia um e-mail com um link de redefinição.
   3. Ao clicar no link, o Supabase abre este site novamente
      já autenticado num modo especial e dispara o evento
      "PASSWORD_RECOVERY" (capturado lá embaixo, no
      onAuthStateChange). Isso mostra o formulário de nova senha.
===================================================== */

async function solicitarRecuperacaoSenha() {

    if (!supabaseClient) {
        mostrarErroAuth("O sistema de contas não foi carregado.");
        return;
    }

    const email = loginEmail?.value.trim() || "";

    if (!email) {
        mostrarErroAuth("Digite seu e-mail no campo acima primeiro, depois clique em \"Esqueci minha senha\".");
        return;
    }

    limparMensagemAuth();

    if (forgotPasswordLink) {
        forgotPasswordLink.disabled = true;
        forgotPasswordLink.textContent = "Enviando link...";
    }

    try {

        const redirectTo = window.location.origin + window.location.pathname;

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo
        });

        if (error) throw error;

        if (loginMessage) {
            loginMessage.style.color = "var(--success)";
            loginMessage.textContent =
                "Se esse e-mail existir na nossa base, enviamos um link de redefinição. Confira sua caixa de entrada.";
        }

    } catch (erro) {

        console.error("Erro ao solicitar recuperação:", erro);

        if (loginMessage) loginMessage.style.color = "";

        mostrarErroAuth(traduzirErroAuth(erro));

    } finally {

        if (forgotPasswordLink) {
            forgotPasswordLink.disabled = false;
            forgotPasswordLink.textContent = "Esqueci minha senha";
        }

    }

}

async function salvarNovaSenha() {

    if (!supabaseClient) {
        mostrarErroAuth("O sistema de contas não foi carregado.");
        return;
    }

    const novaSenha = recoveryPassword?.value || "";

    if (novaSenha.length < 6) {
        mostrarErroAuth("A nova senha precisa ter pelo menos 6 caracteres.");
        return;
    }

    limparMensagemAuth();

    if (recoveryButton) {
        recoveryButton.disabled = true;
        recoveryButton.textContent = "Salvando...";
    }

    try {

        const { error } = await supabaseClient.auth.updateUser({
            password: novaSenha
        });

        if (error) throw error;

        if (recoveryMessage) {
            recoveryMessage.style.color = "var(--success)";
            recoveryMessage.textContent = "Senha atualizada! Redirecionando...";
        }

        setTimeout(async () => {

            const { data } = await supabaseClient.auth.getSession();

            if (data?.session?.user) {
                await iniciarAplicacao(data.session.user);
            } else {
                setAuthMode("login");
            }

        }, 1200);

    } catch (erro) {

        console.error("Erro ao salvar nova senha:", erro);

        if (recoveryMessage) recoveryMessage.style.color = "";

        mostrarErroAuth(traduzirErroAuth(erro));

    } finally {

        if (recoveryButton) {
            recoveryButton.disabled = false;
            recoveryButton.textContent = "Salvar nova senha";
        }

    }

}


/* =====================================================
   LOGOUT
===================================================== */

async function signOut() {
    if (!supabaseClient) return;

    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    } catch (erro) {
        console.error("Erro ao sair:", erro);
        alert("Não foi possível sair da conta.");
        return;
    }

    currentUser = null;
    database = { conversations: [], currentConversation: null };
    selectedImage = null;
    isSending = false;

    fecharSidebar();
    fecharMenuPerfil();
    limparImagem();
    limparPerfilVisual();
    showAuth();
    setAuthMode("login");
    atualizarStatus();
}


/* =====================================================
   PERFIL
===================================================== */

function obterDadosPerfil(user) {
    if (!user) {
        return { nome: "Usuário", email: "", foto: "" };
    }

    const metadata = user.user_metadata || {};

    const nome =
        metadata.name ||
        metadata.full_name ||
        metadata.fullName ||
        metadata.user_name ||
        metadata.preferred_username ||
        user.email?.split("@")[0] ||
        "Usuário";

    const email = user.email || "";

    const foto =
        metadata.avatar_url ||
        metadata.picture ||
        metadata.avatar ||
        "";

    return { nome: String(nome), email: String(email), foto: String(foto) };
}

function obterInicial(nome) {
    const texto = String(nome || "U").trim();
    if (!texto) return "U";
    return texto.charAt(0).toUpperCase();
}

function criarAvatarElemento(elemento, nome, foto) {
    if (!elemento) return;

    elemento.innerHTML = "";

    if (foto) {
        const img = document.createElement("img");
        img.src = foto;
        img.alt = nome;
        img.referrerPolicy = "no-referrer";

        img.onerror = () => {
            elemento.innerHTML = "";
            elemento.textContent = obterInicial(nome);
        };

        elemento.appendChild(img);
        return;
    }

    elemento.textContent = obterInicial(nome);
}

function atualizarPerfil() {
    if (!currentUser) return;

    const perfil = obterDadosPerfil(currentUser);

    if (userName) userName.textContent = perfil.nome;
    if (userEmail) userEmail.textContent = perfil.email;

    criarAvatarElemento(userAvatar, perfil.nome, perfil.foto);
}

function limparPerfilVisual() {
    if (userName) userName.textContent = "Usuário";
    if (userEmail) userEmail.textContent = "—";
    if (userAvatar) userAvatar.innerHTML = "U";
}

function alternarMenuPerfil() {
    if (!profileMenu) return;
    profileMenu.classList.toggle("hidden");
}

function fecharMenuPerfil() {
    if (!profileMenu) return;
    profileMenu.classList.add("hidden");
}


/* =====================================================
   SIDEBAR MOBILE
===================================================== */

function abrirSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.classList.add("visible");
}

function fecharSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("visible");
}


/* =====================================================
   CONVERSAS
===================================================== */

async function carregarConversasSupabase() {
    if (!currentUser || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from("conversations")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        database.conversations = (data || []).map(conversa => ({
            id: conversa.id,
            title: conversa.title || "Nova conversa",
            messages: Array.isArray(conversa.messages) ? conversa.messages : [],
            created_at: conversa.created_at,
            updated_at: conversa.updated_at
        }));

        if (database.conversations.length === 0) {
            await criarNovaConversa(false);
        } else {
            database.currentConversation = database.conversations[0].id;
        }

        salvarLocal();
        renderizarConversas();
        carregarConversaAtual();
    } catch (erro) {
        console.error("Erro ao carregar conversas:", erro);
        renderizarConversas();
        carregarConversaAtual();
    }
}

async function salvarConversaSupabase(conversa) {
    if (!currentUser || !conversa || !supabaseClient) return;

    const payload = {
        id: conversa.id,
        user_id: currentUser.id,
        title: conversa.title || "Nova conversa",
        messages: conversa.messages || [],
        updated_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabaseClient
            .from("conversations")
            .upsert(payload, { onConflict: "id" })
            .select()
            .single();

        if (error) throw error;

        if (data) conversa.updated_at = data.updated_at;

        salvarLocal();
    } catch (erro) {
        console.error("Erro ao salvar conversa:", erro);
        salvarLocal();
    }
}

async function deletarConversa(conversaId) {
    if (!conversaId) return;

    const conversa = database.conversations.find(item => item.id === conversaId);
    if (!conversa) return;

    if (currentUser && supabaseClient) {
        try {
            const { error } = await supabaseClient
                .from("conversations")
                .delete()
                .eq("id", conversaId)
                .eq("user_id", currentUser.id);

            if (error) throw error;
        } catch (erro) {
            console.error("Erro ao excluir conversa:", erro);
            alert("Não foi possível excluir a conversa agora. Tente novamente.");
            return;
        }
    }

    database.conversations = database.conversations.filter(item => item.id !== conversaId);

    if (database.currentConversation === conversaId) {
        database.currentConversation =
            database.conversations.length ? database.conversations[0].id : null;
    }

    salvarLocal();
    renderizarConversas();
    carregarConversaAtual();
}


/* =====================================================
   NOVA CONVERSA
===================================================== */

async function criarNovaConversa(salvarOnline = true) {
    const conversa = {
        id: gerarId(),
        title: "Nova conversa",
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    database.conversations.unshift(conversa);
    database.currentConversation = conversa.id;

    salvarLocal();
    renderizarConversas();
    carregarConversaAtual();
    fecharSidebar();

    if (salvarOnline) {
        await salvarConversaSupabase(conversa);
    }

    if (messageInput) {
        setTimeout(() => messageInput.focus(), 100);
    }
}

function gerarId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return "zynor-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}


/* =====================================================
   CONVERSA ATUAL
===================================================== */

function obterConversaAtual() {
    if (!database.currentConversation) return null;

    return database.conversations.find(
        conversa => conversa.id === database.currentConversation
    ) || null;
}


/* =====================================================
   SIDEBAR — LISTA (com botão de deletar)
===================================================== */

function renderizarConversas() {

    if (!conversationList) return;

    conversationList.innerHTML = "";

    database.conversations.forEach(conversa => {

        const item = document.createElement("button");
        item.className = "conversation-item";

        if (conversa.id === database.currentConversation) {
            item.classList.add("active");
        }

        const titulo = document.createElement("span");
        titulo.textContent = conversa.title || "Nova conversa";
        item.appendChild(titulo);

        const excluir = document.createElement("span");
        excluir.className = "conversation-delete";
        excluir.textContent = "🗑";
        excluir.title = "Excluir conversa";
        excluir.setAttribute("role", "button");

        excluir.addEventListener("click", async event => {

            event.stopPropagation();

            const confirmar = confirm(
                `Excluir a conversa "${conversa.title || "Nova conversa"}"? Essa ação não pode ser desfeita.`
            );

            if (confirmar) {
                await deletarConversa(conversa.id);
            }

        });

        item.appendChild(excluir);

        item.addEventListener("click", () => {
            database.currentConversation = conversa.id;
            salvarLocal();
            renderizarConversas();
            carregarConversaAtual();
            fecharSidebar();
        });

        conversationList.appendChild(item);

    });

}


/* =====================================================
   CARREGAR CONVERSA
===================================================== */

function carregarConversaAtual() {

    if (!chat) return;

    const conversa = obterConversaAtual();

    if (!conversa) {
        showWelcome();
        return;
    }

    chat.innerHTML = "";

    if (!conversa.messages || conversa.messages.length === 0) {
        showWelcome();
        return;
    }

    conversa.messages.forEach((mensagem, indice) => {

        const ehUltima = indice === conversa.messages.length - 1;
        const podeRegenerar = ehUltima && mensagem.role === "assistant";

        addMessage(mensagem.role, mensagem.content, false, mensagem.image || null, podeRegenerar);

    });

    scrollChat();

}


/* =====================================================
   WELCOME
===================================================== */

function showWelcome() {

    if (!chat) return;

    chat.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">Z</div>
            <h2>Olá, eu sou a Zynor.</h2>
            <p>Uma IA criada para ajudar você de forma simples, rápida e prática.</p>
            <div class="suggestions">
                <button class="suggestion" data-prompt="Explique um assunto difícil de maneira simples.">
                    Explique algo difícil de maneira simples
                </button>
                <button class="suggestion" data-prompt="Me ajude a criar um projeto.">
                    Me ajude a criar um projeto
                </button>
                <button class="suggestion" data-prompt="Me ensine alguma coisa interessante.">
                    Me ensine alguma coisa interessante
                </button>
                <button class="suggestion" data-prompt="Me ajude a resolver um problema.">
                    Me ajude a resolver um problema
                </button>
            </div>
        </div>
    `;

    document.querySelectorAll(".suggestion").forEach(botao => {

        botao.addEventListener("click", () => {

            if (messageInput) {
                messageInput.value = botao.dataset.prompt;
                ajustarTextarea();
                messageInput.focus();
            }

        });

    });

}


/* =====================================================
   MENSAGEM (com botão de copiar e, quando aplicável,
   botão de regenerar)
===================================================== */

function addMessage(role, content, scroll = true, image = null, podeRegenerar = false) {

    if (!chat) return;

    const message = document.createElement("div");
    message.className = "message " + (role === "user" ? "user" : "assistant");

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (image) {
        const img = document.createElement("img");
        img.src = image;
        img.className = "message-image";
        img.alt = "Imagem enviada";
        bubble.appendChild(img);
    }

    if (content) {
        const texto = document.createElement("div");
        texto.innerHTML = formatarResposta(content);
        bubble.appendChild(texto);
    }

    message.appendChild(bubble);

    if (role === "assistant" && content) {

        const acoes = document.createElement("div");
        acoes.className = "message-actions";

        const copiar = document.createElement("button");
        copiar.className = "copy-button";
        copiar.type = "button";
        copiar.textContent = "📋 Copiar";

        copiar.addEventListener("click", async () => {

            try {
                await navigator.clipboard.writeText(content);
                copiar.textContent = "✓ Copiado";
                setTimeout(() => { copiar.textContent = "📋 Copiar"; }, 1500);
            } catch (erro) {
                console.warn("Não foi possível copiar:", erro);
            }

        });

        acoes.appendChild(copiar);

        if (podeRegenerar) {

            const regenerar = document.createElement("button");
            regenerar.className = "regenerate-button";
            regenerar.type = "button";
            regenerar.textContent = "🔄 Regenerar";

            regenerar.addEventListener("click", regenerarResposta);

            acoes.appendChild(regenerar);

        }

        bubble.appendChild(acoes);

    }

    chat.appendChild(message);

    if (scroll) scrollChat();

}


/* =====================================================
   FORMATAÇÃO (Markdown básico e seguro)
===================================================== */

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

function formatarResposta(texto) {

    if (!texto) return "";

    let seguro = escaparHTML(String(texto));

    const blocosCodigo = [];

    seguro = seguro.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, linguagem, codigo) => {
        const indice = blocosCodigo.length;
        blocosCodigo.push(codigo.trim());
        return "___ZYNOR_CODE_" + indice + "___";
    });

    seguro = seguro
        .split("\n")
        .map(linha => {
            const tituloMatch = linha.match(/^(#{1,3})\s+(.*)$/);
            if (tituloMatch) {
                const nivel = tituloMatch[1].length;
                return `___ZYNOR_H${nivel}_START___${tituloMatch[2]}___ZYNOR_H${nivel}_END___`;
            }
            return linha;
        })
        .join("\n");

    seguro = seguro.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, txt, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`;
    });

    seguro = seguro.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    seguro = seguro.replace(/`([^`]+)`/g, "<code>$1</code>");

    const linhas = seguro.split("\n");
    const linhasProcessadas = [];
    let listaAberta = null;

    linhas.forEach(linha => {

        const itemNaoOrdenado = linha.match(/^\s*[-*]\s+(.*)$/);
        const itemOrdenado = linha.match(/^\s*\d+\.\s+(.*)$/);

        if (itemNaoOrdenado) {
            if (listaAberta !== "ul") {
                if (listaAberta) linhasProcessadas.push(`</${listaAberta}>`);
                linhasProcessadas.push("<ul>");
                listaAberta = "ul";
            }
            linhasProcessadas.push(`<li>${itemNaoOrdenado[1]}</li>`);
        } else if (itemOrdenado) {
            if (listaAberta !== "ol") {
                if (listaAberta) linhasProcessadas.push(`</${listaAberta}>`);
                linhasProcessadas.push("<ol>");
                listaAberta = "ol";
            }
            linhasProcessadas.push(`<li>${itemOrdenado[1]}</li>`);
        } else {
            if (listaAberta) {
                linhasProcessadas.push(`</${listaAberta}>`);
                listaAberta = null;
            }
            linhasProcessadas.push(linha);
        }

    });

    if (listaAberta) linhasProcessadas.push(`</${listaAberta}>`);

    seguro = linhasProcessadas.join("\n");

    seguro = seguro
        .replace(/___ZYNOR_H1_START___(.*?)___ZYNOR_H1_END___/g, "<h1>$1</h1>")
        .replace(/___ZYNOR_H2_START___(.*?)___ZYNOR_H2_END___/g, "<h2>$1</h2>")
        .replace(/___ZYNOR_H3_START___(.*?)___ZYNOR_H3_END___/g, "<h3>$1</h3>");

    seguro = seguro.replace(/\n/g, "<br>");

    blocosCodigo.forEach((codigo, indice) => {
        const placeholder = "___ZYNOR_CODE_" + indice + "___";
        const bloco = `<pre><code>${codigo}</code></pre>`;
        seguro = seguro.replace(placeholder, bloco);
    });

    return seguro;

}


/* =====================================================
   THINKING
===================================================== */

function showThinking() {
    removeThinking();

    if (!chat) return;

    const thinking = document.createElement("div");
    thinking.id = "zynor-thinking";
    thinking.className = "thinking";
    thinking.innerHTML = `<span></span><span></span><span></span>`;

    chat.appendChild(thinking);
    scrollChat();
}

function hideThinking() {
    removeThinking();
}

function removeThinking() {
    const thinking = document.getElementById("zynor-thinking");
    if (thinking) thinking.remove();
}


/* =====================================================
   SCROLL
===================================================== */

function scrollChat() {
    if (!chat) return;

    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
    });
}


/* =====================================================
   HISTÓRICO PARA IA
===================================================== */

function criarMensagensIA(texto, imagemBase64, historico) {

    const mensagens = [];

    mensagens.push({
        role: "system",
        content: Zynor.personality
    });

    const historicoLimitado = Array.isArray(historico) ? historico.slice(-8) : [];

    historicoLimitado.forEach((mensagem, indice) => {

        if (!mensagem || !mensagem.role) return;
        if (mensagem.role !== "user" && mensagem.role !== "assistant") return;
        if (!mensagem.content && !mensagem.image) return;

        const ehUltimaDoHistorico = indice === historicoLimitado.length - 1;

        if (mensagem.role === "user" && mensagem.image && ehUltimaDoHistorico) {

            mensagens.push({
                role: "user",
                content: [
                    { type: "text", text: mensagem.content || "Analise esta imagem." },
                    { type: "image_url", image_url: { url: mensagem.image } }
                ]
            });

        } else if (mensagem.role === "user" && mensagem.image) {

            mensagens.push({
                role: "user",
                content: (mensagem.content || "") + " [imagem enviada anteriormente]"
            });

        } else {

            mensagens.push({
                role: mensagem.role,
                content: mensagem.content || ""
            });

        }

    });

    const ultimaMensagem = historicoLimitado[historicoLimitado.length - 1];

    if (!ultimaMensagem || ultimaMensagem.content !== texto) {

        if (imagemBase64) {

            mensagens.push({
                role: "user",
                content: [
                    { type: "text", text: texto || "Analise esta imagem." },
                    { type: "image_url", image_url: { url: imagemBase64 } }
                ]
            });

        } else {

            mensagens.push({
                role: "user",
                content: texto || ""
            });

        }

    }

    return mensagens;

}


/* =====================================================
   PERGUNTAR IA
===================================================== */

async function perguntarIA(texto, imagemBase64, historico, signal) {

    if (!currentUser) {
        throw new Error("Você precisa estar conectado.");
    }
    if (!supabaseClient) {
        throw new Error("O sistema da Zynor não foi carregado corretamente.");
    }

    let session = null;

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        session = data?.session || null;
    } catch (erro) {
        console.error("Erro ao obter sessão:", erro);
    }

    if (!session?.access_token) {

        try {
            const { data, error } = await supabaseClient.auth.refreshSession();
            if (error) throw error;
            session = data?.session || null;
        } catch (erro) {
            console.error("Erro ao renovar sessão:", erro);
            throw new Error("Sua sessão expirou. Entre novamente na conta.");
        }

    }

    if (!session?.access_token) {
        throw new Error("Sua sessão não está disponível. Entre novamente na conta.");
    }

    const messages = criarMensagensIA(texto, imagemBase64, historico);

    let resposta;

    try {

        resposta = await fetch(ZYNOR_API_URL, {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            signal,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + session.access_token
            },
            body: JSON.stringify({ messages })
        });

    } catch (erro) {

        if (erro.name === "AbortError") throw erro;

        console.error("Erro de conexão:", erro);
        throw new Error("Não foi possível conectar à Zynor. Verifique sua internet e tente novamente.");

    }

    let dados = null;

    try {
        dados = await resposta.json();
    } catch (erro) {
        console.error("Resposta inválida:", erro);
        throw new Error("O servidor da Zynor enviou uma resposta inválida.");
    }

    if (!resposta.ok) {

        console.error("Erro da Edge Function:", resposta.status, dados);

        if (resposta.status === 401) {
            throw new Error("Sua sessão não foi aceita pelo servidor. Entre novamente na conta.");
        }
        if (resposta.status === 402) {
            throw new Error("O provedor de IA informou que não há créditos disponíveis.");
        }
        if (resposta.status === 429) {
            throw new Error("A Zynor está recebendo muitas solicitações. Aguarde alguns segundos.");
        }

        throw new Error(dados?.error || dados?.message || "Erro ao conversar com a Zynor.");

    }

    const conteudo =
        dados?.choices?.[0]?.message?.content ||
        dados?.content ||
        dados?.resposta ||
        dados?.answer;

    if (typeof conteudo === "string" && conteudo.trim()) {
        return conteudo.trim();
    }

    console.error("Resposta sem conteúdo:", dados);
    throw new Error("A Zynor recebeu uma resposta vazia.");

}


/* =====================================================
   ENVIAR MENSAGEM / PROCESSAR RESPOSTA (compartilhado
   entre envio normal e regenerar)
===================================================== */

async function processarResposta(conversa) {

    isSending = true;
    alternarBotaoEnviar(true);

    showThinking();

    currentAbortController = new AbortController();

    try {

        const ultimaMensagemUsuario = [...conversa.messages].reverse().find(m => m.role === "user");

        const resposta = await perguntarIA(
            ultimaMensagemUsuario?.content || "",
            ultimaMensagemUsuario?.image || null,
            conversa.messages,
            currentAbortController.signal
        );

        hideThinking();

        conversa.messages.push({
            role: "assistant",
            content: resposta,
            created_at: new Date().toISOString()
        });

        addMessage("assistant", resposta, true, null, true);

        conversa.updated_at = new Date().toISOString();

        salvarLocal();

        await salvarConversaSupabase(conversa);

        renderizarConversas();

    } catch (erro) {

        hideThinking();

        if (erro.name === "AbortError") {
            addMessage("assistant", "_Geração interrompida pelo usuário._", true);
        } else {
            console.error("Erro Zynor:", erro);
            const mensagemErro = `Não consegui responder agora.\n\n${traduzirErroIA(erro)}`;
            addMessage("assistant", mensagemErro, true);
        }

    } finally {

        isSending = false;
        currentAbortController = null;
        alternarBotaoEnviar(false);

        if (messageInput) {
            setTimeout(() => messageInput.focus(), 100);
        }

    }

}

async function enviarMensagem() {

    if (isSending) return;

    const texto = messageInput?.value.trim() || "";

    if (!texto && !selectedImage) return;

    if (!currentUser) {
        showAuth();
        mostrarErroAuth("Faça login para usar a Zynor.");
        return;
    }

    let conversa = obterConversaAtual();

    if (!conversa) {
        await criarNovaConversa();
        conversa = obterConversaAtual();
    }

    if (!conversa) return;

    const imagem = selectedImage;
    const mensagemTexto = texto || "Analise esta imagem.";

    if (conversa.messages.length === 0) {
        conversa.title = criarTitulo(mensagemTexto);
    }

    conversa.messages.push({
        role: "user",
        content: mensagemTexto,
        image: imagem || null,
        created_at: new Date().toISOString()
    });

    addMessage("user", mensagemTexto, true, imagem);

    if (messageInput) messageInput.value = "";

    ajustarTextarea();
    limparImagem();
    salvarLocal();

    await salvarConversaSupabase(conversa);

    await processarResposta(conversa);

}

async function regenerarResposta() {

    if (isSending) return;

    const conversa = obterConversaAtual();

    if (!conversa || conversa.messages.length === 0) return;

    const ultima = conversa.messages[conversa.messages.length - 1];

    if (ultima.role !== "assistant") return;

    conversa.messages.pop();

    const bolhasAssistente = chat.querySelectorAll(".message.assistant");
    const ultimaBolha = bolhasAssistente[bolhasAssistente.length - 1];

    if (ultimaBolha) ultimaBolha.remove();

    await processarResposta(conversa);

}

function pararGeracao() {
    if (currentAbortController) {
        currentAbortController.abort();
    }
}

function alternarBotaoEnviar(enviando) {

    if (sendButton) sendButton.disabled = enviando;

    if (enviando) {
        esconderElemento(sendButton);
        mostrarElemento(stopButton);
    } else {
        mostrarElemento(sendButton);
        esconderElemento(stopButton);
    }

}


/* =====================================================
   TÍTULO
===================================================== */

function criarTitulo(texto) {

    const limpo = String(texto).replace(/\s+/g, " ").trim();

    if (!limpo) return "Nova conversa";
    if (limpo.length <= 34) return limpo;

    return limpo.slice(0, 34) + "...";

}


/* =====================================================
   ERROS IA
===================================================== */

function traduzirErroIA(erro) {
    const mensagem = String(erro?.message || "");
    return mensagem || "Ocorreu um erro desconhecido.";
}


/* =====================================================
   IMAGEM (agora com validação de tamanho)
===================================================== */

function prepararImagem(file) {

    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
        alert("Escolha um arquivo de imagem.");
        return;
    }

    if (file.size > TAMANHO_MAXIMO_IMAGEM) {
        alert("Essa imagem é muito grande (máximo 8MB). Escolha uma imagem menor.");
        return;
    }

    const reader = new FileReader();

    reader.onload = event => {

        const original = event.target.result;
        const img = new Image();

        img.onload = () => {

            const maxSize = 1280;
            let largura = img.width;
            let altura = img.height;

            if (largura > maxSize || altura > maxSize) {
                const escala = Math.min(maxSize / largura, maxSize / altura);
                largura = Math.round(largura * escala);
                altura = Math.round(altura * escala);
            }

            const canvas = document.createElement("canvas");
            canvas.width = largura;
            canvas.height = altura;

            const contexto = canvas.getContext("2d");

            if (!contexto) {
                selectedImage = original;
            } else {
                contexto.drawImage(img, 0, 0, largura, altura);
                selectedImage = canvas.toDataURL("image/jpeg", 0.78);
            }

            if (previewImage) previewImage.src = selectedImage;

            mostrarElemento(imagePreview);

        };

        img.onerror = () => {
            selectedImage = original;
            if (previewImage) previewImage.src = original;
            mostrarElemento(imagePreview);
        };

        img.src = original;

    };

    reader.onerror = () => {
        alert("Não foi possível carregar esta imagem.");
    };

    reader.readAsDataURL(file);

}

function limparImagem() {

    selectedImage = null;

    if (imageInput) imageInput.value = "";
    if (previewImage) previewImage.src = "";

    esconderElemento(imagePreview);

}


/* =====================================================
   TEXTAREA
===================================================== */

function ajustarTextarea() {
    if (!messageInput) return;

    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
}


/* =====================================================
   CONFIGURAÇÕES
===================================================== */

function abrirConfiguracoes() {

    fecharMenuPerfil();

    alert(
        "ZYNOR IA\n\n" +
        "Versão: " + Zynor.version +
        "\n\nStatus: " + (currentUser ? "Online" : "Offline")
    );

}


/* =====================================================
   SOBRE
===================================================== */

function abrirSobre() {

    alert(
        "Zynor IA\n\n" +
        "Versão " + Zynor.version +
        "\n\n" +
        "Assistente de inteligência artificial."
    );

}


/* =====================================================
   STATUS
===================================================== */

function atualizarStatus() {
    if (!statusText) return;

    statusText.textContent = currentUser ? "Online" : "Offline";
    statusText.classList.toggle("offline", !currentUser);
}


/* =====================================================
   INICIAR APLICAÇÃO
===================================================== */

async function iniciarAplicacao(user) {

    currentUser = user;

    showApp();
    atualizarStatus();
    atualizarPerfil();

    await carregarConversasSupabase();

    if (messageInput) {
        setTimeout(() => messageInput.focus(), 150);
    }

}


/* =====================================================
   EVENTOS AUTH
===================================================== */

showSignup?.addEventListener("click", () => setAuthMode("signup"));
showLogin?.addEventListener("click", () => setAuthMode("login"));

loginButton?.addEventListener("click", signIn);
signupButton?.addEventListener("click", signUp);
forgotPasswordLink?.addEventListener("click", solicitarRecuperacaoSenha);
recoveryButton?.addEventListener("click", salvarNovaSenha);

signupPassword?.addEventListener("input", atualizarIndicadorSenha);

[loginEmail, loginPassword].forEach(campo => {
    campo?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            signIn();
        }
    });
});

[signupName, signupEmail, signupPassword].forEach(campo => {
    campo?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            signUp();
        }
    });
});

recoveryPassword?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        salvarNovaSenha();
    }
});


/* =====================================================
   SIDEBAR
===================================================== */

openSidebarButton?.addEventListener("click", abrirSidebar);
closeSidebarButton?.addEventListener("click", fecharSidebar);
sidebarOverlay?.addEventListener("click", fecharSidebar);


/* =====================================================
   NOVA CONVERSA
===================================================== */

newChat?.addEventListener("click", () => criarNovaConversa());


/* =====================================================
   ENVIAR / PARAR
===================================================== */

sendButton?.addEventListener("click", enviarMensagem);
stopButton?.addEventListener("click", pararGeracao);

messageInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        enviarMensagem();
    }
});

messageInput?.addEventListener("input", ajustarTextarea);


/* =====================================================
   IMAGEM
===================================================== */

imageButton?.addEventListener("click", () => imageInput?.click());

imageInput?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    prepararImagem(file);
});

removeImage?.addEventListener("click", limparImagem);


/* =====================================================
   CONFIGURAÇÕES
===================================================== */

settingsBtn?.addEventListener("click", () => {
    fecharSidebar();
    abrirConfiguracoes();
});

aboutBtn?.addEventListener("click", () => {
    fecharSidebar();
    abrirSobre();
});


/* =====================================================
   PERFIL
===================================================== */

userProfileButton?.addEventListener("click", event => {
    event.stopPropagation();
    alternarMenuPerfil();
});

profileSettings?.addEventListener("click", () => {
    fecharMenuPerfil();
    abrirConfiguracoes();
});

logoutButton?.addEventListener("click", async () => {

    fecharMenuPerfil();

    const confirmar = confirm("Deseja realmente sair da sua conta?");

    if (confirmar) {
        await signOut();
    }

});

document.addEventListener("click", event => {
    if (userProfile && !userProfile.contains(event.target)) {
        fecharMenuPerfil();
    }
});


/* =====================================================
   SUPABASE AUTH STATE
===================================================== */

if (supabaseClient) {

    supabaseClient.auth.onAuthStateChange(async (event, session) => {

        if (event === "PASSWORD_RECOVERY") {

            showAuth();
            setAuthMode("recovery");
            return;

        }

        if (event === "SIGNED_IN" && session?.user) {

            currentUser = session.user;

            showApp();
            atualizarStatus();
            atualizarPerfil();

            if (database.conversations.length === 0) {
                await carregarConversasSupabase();
            }

        }

        if (event === "SIGNED_OUT") {

            currentUser = null;
            database = { conversations: [], currentConversation: null };
            selectedImage = null;
            isSending = false;

            fecharSidebar();
            fecharMenuPerfil();
            limparImagem();
            showAuth();
            limparPerfilVisual();
            atualizarStatus();

        }

    });

}


/* =====================================================
   INICIALIZAÇÃO
===================================================== */

async function iniciarZynor() {

    carregarLocal();
    atualizarConexao();
    showAuth();
    setAuthMode("login");

    if (!SUPABASE_PUBLISHABLE_KEY) {
        mostrarErroAuth("Configure a Publishable Key do Supabase.");
        return;
    }

    if (!supabaseClient) {
        mostrarErroAuth("Não foi possível carregar o sistema do Supabase.");
        return;
    }

    // Se o link de recuperação de senha trouxe "type=recovery" na URL,
    // o evento PASSWORD_RECOVERY acima cuida de mostrar a tela certa.
    // Aqui só tratamos o caso normal de sessão já existente.

    try {

        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (data?.session?.user && !window.location.hash.includes("type=recovery")) {
            await iniciarAplicacao(data.session.user);
        } else if (!window.location.hash.includes("type=recovery")) {
            showAuth();
        }

    } catch (erro) {

        console.error("Erro ao iniciar Zynor:", erro);
        showAuth();
        mostrarErroAuth("Não foi possível conectar ao sistema de contas.");

    }

}


/* =====================================================
   START
===================================================== */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarZynor);
} else {
    iniciarZynor();
}