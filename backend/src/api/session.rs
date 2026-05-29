#[derive(Clone, Debug)]
// API-owned authenticated request context extracted by middleware for handlers.
pub(crate) struct AuthenticatedSession {
    pub(crate) user_id: String,
    pub(crate) favorite_gym_id: Option<String>,
}
