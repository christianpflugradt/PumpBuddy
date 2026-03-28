#[derive(Clone, Debug)]
pub(crate) struct AuthenticatedSession {
    pub(crate) user_id: String,
    pub(crate) display_name: String,
}
