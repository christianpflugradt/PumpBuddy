use crate::{
    domain::{GymDetail, GymStationDetail, GymSummary},
    persistence::{GymRepository, PersistenceError},
};

#[derive(Debug)]
pub enum GymServiceError {
    NotFound(String),
    Persistence(PersistenceError),
}

pub(crate) async fn list_gyms(
    repository: &(impl GymRepository + ?Sized),
    user_id: &str,
    favorite_gym_id: Option<&str>,
) -> Result<Vec<GymSummary>, GymServiceError> {
    repository
        .fetch_gym_summaries_for_user_with_favorite(user_id, favorite_gym_id)
        .await
        .map_err(GymServiceError::Persistence)
}

pub(crate) async fn get_gym_detail(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
) -> Result<GymDetail, GymServiceError> {
    repository
        .fetch_gym_detail_for_user(gym_id, user_id)
        .await
        .map_err(GymServiceError::Persistence)?
        .ok_or_else(|| GymServiceError::NotFound("Gym not found".to_owned()))
}

pub(crate) async fn get_gym_station_detail(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<GymStationDetail, GymServiceError> {
    repository
        .fetch_gym_station_detail_for_user(gym_id, station_id, user_id)
        .await
        .map_err(GymServiceError::Persistence)?
        .ok_or_else(|| GymServiceError::NotFound("Gym station not found".to_owned()))
}

#[cfg(test)]
mod tests {
    use super::{get_gym_detail, GymServiceError};
    use crate::{
        domain::{GymDetail, GymStationDetail, GymSummary},
        persistence::{GymRepository, PersistenceError},
    };

    struct FakeGymRepository {
        detail: Option<GymDetail>,
    }

    impl GymRepository for FakeGymRepository {
        async fn fetch_gym_summaries_for_user_with_favorite(
            &self,
            _user_id: &str,
            _favorite_gym_id: Option<&str>,
        ) -> Result<Vec<GymSummary>, PersistenceError> {
            Ok(Vec::new())
        }

        async fn fetch_gym_detail_for_user(
            &self,
            _gym_id: &str,
            _user_id: &str,
        ) -> Result<Option<GymDetail>, PersistenceError> {
            Ok(self.detail.clone())
        }

        async fn fetch_gym_station_detail_for_user(
            &self,
            _gym_id: &str,
            _station_id: &str,
            _user_id: &str,
        ) -> Result<Option<GymStationDetail>, PersistenceError> {
            Ok(None)
        }
    }

    #[tokio::test]
    async fn get_gym_detail_maps_absent_repository_detail_to_not_found() {
        let repository = FakeGymRepository { detail: None };

        match get_gym_detail(&repository, "missing-gym", "user-id")
            .await
            .expect_err("missing gym should be treated as not found")
        {
            GymServiceError::NotFound(message) => {
                assert_eq!(message, "Gym not found");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
