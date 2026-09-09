use crate::{
    domain::{
        ConfiguratorStation, ConfiguratorStationUpdate, GymDetail, GymStationDetail, GymSummary,
        GymUpdate, NewConfiguratorStation, NewGym,
    },
    persistence::{GymRepository, PersistenceError},
};

#[derive(Debug)]
pub enum GymServiceError {
    Conflict(String),
    NotFound(String),
    Persistence(PersistenceError),
    Validation(String),
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

#[allow(dead_code)]
pub(crate) async fn create_gym(
    repository: &(impl GymRepository + ?Sized),
    user_id: &str,
    mut command: NewGym,
) -> Result<GymSummary, GymServiceError> {
    normalize_name(&mut command.name)?;

    if repository
        .gym_name_exists_for_user(user_id, &command.name, None)
        .await
        .map_err(GymServiceError::Persistence)?
    {
        return Err(GymServiceError::Conflict(
            "Gym name already exists".to_owned(),
        ));
    }

    repository
        .create_gym_for_user(user_id, &command)
        .await
        .map_err(map_persistence_error)
}

#[allow(dead_code)]
pub(crate) async fn update_gym(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
    mut command: GymUpdate,
) -> Result<GymSummary, GymServiceError> {
    normalize_name(&mut command.name)?;

    if repository
        .gym_name_exists_for_user(user_id, &command.name, Some(gym_id))
        .await
        .map_err(GymServiceError::Persistence)?
    {
        return Err(GymServiceError::Conflict(
            "Gym name already exists".to_owned(),
        ));
    }

    repository
        .update_gym_for_user(gym_id, user_id, &command)
        .await
        .map_err(map_persistence_error)
}

#[allow(dead_code)]
pub(crate) async fn delete_gym(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
) -> Result<(), GymServiceError> {
    repository
        .delete_gym_for_user(gym_id, user_id)
        .await
        .map_err(map_persistence_error)
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

pub(crate) async fn get_configurator_station(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<ConfiguratorStation, GymServiceError> {
    repository
        .fetch_configurator_station_for_user(gym_id, station_id, user_id)
        .await
        .map_err(GymServiceError::Persistence)?
        .ok_or_else(|| GymServiceError::NotFound("Station not found".to_owned()))
}

pub(crate) async fn create_configurator_station(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
    mut command: NewConfiguratorStation,
) -> Result<ConfiguratorStation, GymServiceError> {
    normalize_name(&mut command.name)?;
    if repository
        .station_name_exists_for_user(gym_id, user_id, &command.name, None)
        .await
        .map_err(GymServiceError::Persistence)?
    {
        return Err(GymServiceError::Conflict(
            "Station name already exists in this gym".to_owned(),
        ));
    }
    repository
        .create_configurator_station_for_user(gym_id, user_id, &command)
        .await
        .map_err(map_persistence_error)
}

pub(crate) async fn update_configurator_station(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    station_id: &str,
    user_id: &str,
    mut command: ConfiguratorStationUpdate,
) -> Result<ConfiguratorStation, GymServiceError> {
    normalize_name(&mut command.name)?;
    if repository
        .station_name_exists_for_user(gym_id, user_id, &command.name, Some(station_id))
        .await
        .map_err(GymServiceError::Persistence)?
    {
        return Err(GymServiceError::Conflict(
            "Station name already exists in this gym".to_owned(),
        ));
    }
    repository
        .update_configurator_station_for_user(gym_id, station_id, user_id, &command)
        .await
        .map_err(map_persistence_error)
}

pub(crate) async fn delete_configurator_station(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<(), GymServiceError> {
    repository
        .delete_configurator_station_for_user(gym_id, station_id, user_id)
        .await
        .map_err(map_persistence_error)
}

#[allow(dead_code)]
fn map_persistence_error(error: PersistenceError) -> GymServiceError {
    match error {
        PersistenceError::Conflict(message) => GymServiceError::Conflict(message),
        PersistenceError::NotFound(message) => GymServiceError::NotFound(message),
        other => GymServiceError::Persistence(other),
    }
}

#[allow(dead_code)]
fn normalize_name(name: &mut String) -> Result<(), GymServiceError> {
    *name = name.trim().to_owned();
    if name.is_empty() {
        return Err(GymServiceError::Validation("name is required".to_owned()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{create_gym, delete_gym, get_gym_detail, update_gym, GymServiceError};
    use crate::{
        domain::{GymDetail, GymStationDetail, GymSummary, GymUpdate, NewGym},
        persistence::{GymRepository, PersistenceError},
    };

    struct FakeGymRepository {
        detail: Option<GymDetail>,
        update_status: String,
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

        async fn gym_name_exists_for_user(
            &self,
            user_id: &str,
            name: &str,
            excluding_id: Option<&str>,
        ) -> Result<bool, PersistenceError> {
            Ok(user_id == "user-a"
                && name.eq_ignore_ascii_case("duplicate")
                && excluding_id != Some("duplicate-gym"))
        }

        async fn create_gym_for_user(
            &self,
            _user_id: &str,
            new_gym: &NewGym,
        ) -> Result<GymSummary, PersistenceError> {
            Ok(GymSummary {
                id: "new-gym".to_owned(),
                name: new_gym.name.clone(),
                status: "new".to_owned(),
                station_count: 0,
                last_visited_at: None,
            })
        }

        async fn update_gym_for_user(
            &self,
            gym_id: &str,
            _user_id: &str,
            update: &GymUpdate,
        ) -> Result<GymSummary, PersistenceError> {
            Ok(GymSummary {
                id: gym_id.to_owned(),
                name: update.name.clone(),
                status: self.update_status.clone(),
                station_count: 0,
                last_visited_at: None,
            })
        }

        async fn delete_gym_for_user(
            &self,
            gym_id: &str,
            _user_id: &str,
        ) -> Result<(), PersistenceError> {
            match gym_id {
                "new-gym" => Ok(()),
                "active-gym" | "inactive-gym" => Err(PersistenceError::Conflict(
                    "Only draft gyms can be deleted".to_owned(),
                )),
                _ => Err(PersistenceError::NotFound("Gym not found".to_owned())),
            }
        }

        async fn fetch_gym_station_detail_for_user(
            &self,
            _gym_id: &str,
            _station_id: &str,
            _user_id: &str,
        ) -> Result<Option<GymStationDetail>, PersistenceError> {
            Ok(None)
        }

        async fn fetch_configurator_station_for_user(
            &self,
            _gym_id: &str,
            _station_id: &str,
            _user_id: &str,
        ) -> Result<Option<crate::domain::ConfiguratorStation>, PersistenceError> {
            Ok(None)
        }
        async fn station_name_exists_for_user(
            &self,
            _gym_id: &str,
            _user_id: &str,
            _name: &str,
            _excluding_id: Option<&str>,
        ) -> Result<bool, PersistenceError> {
            Ok(false)
        }
        async fn create_configurator_station_for_user(
            &self,
            _gym_id: &str,
            _user_id: &str,
            _station: &crate::domain::NewConfiguratorStation,
        ) -> Result<crate::domain::ConfiguratorStation, PersistenceError> {
            Err(PersistenceError::NotFound("Station not found".to_owned()))
        }
        async fn update_configurator_station_for_user(
            &self,
            _gym_id: &str,
            _station_id: &str,
            _user_id: &str,
            _update: &crate::domain::ConfiguratorStationUpdate,
        ) -> Result<crate::domain::ConfiguratorStation, PersistenceError> {
            Err(PersistenceError::NotFound("Station not found".to_owned()))
        }
        async fn delete_configurator_station_for_user(
            &self,
            _gym_id: &str,
            _station_id: &str,
            _user_id: &str,
        ) -> Result<(), PersistenceError> {
            Err(PersistenceError::NotFound("Station not found".to_owned()))
        }
    }

    #[tokio::test]
    async fn get_gym_detail_maps_absent_repository_detail_to_not_found() {
        let repository = FakeGymRepository {
            detail: None,
            update_status: "new".to_owned(),
        };

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

    #[tokio::test]
    async fn create_gym_trims_a_valid_name_and_returns_draft_status() {
        let repository = FakeGymRepository {
            detail: None,
            update_status: "new".to_owned(),
        };

        let gym = create_gym(
            &repository,
            "user-id",
            NewGym {
                name: "  Local Gym  ".to_owned(),
            },
        )
        .await
        .expect("valid gym should be created");

        assert_eq!(gym.name, "Local Gym");
        assert_eq!(gym.status, "new");
    }

    #[tokio::test]
    async fn create_gym_rejects_blank_and_normalized_duplicate_names() {
        let repository = FakeGymRepository {
            detail: None,
            update_status: "new".to_owned(),
        };

        assert!(matches!(
            create_gym(&repository, "user-id", NewGym { name: "  ".to_owned() }).await,
            Err(GymServiceError::Validation(message)) if message == "name is required"
        ));
        assert!(matches!(
            create_gym(&repository, "user-a", NewGym { name: " Duplicate ".to_owned() }).await,
            Err(GymServiceError::Conflict(message)) if message == "Gym name already exists"
        ));

        assert!(create_gym(
            &repository,
            "user-b",
            NewGym {
                name: "Duplicate".to_owned(),
            },
        )
        .await
        .is_ok());
    }

    #[tokio::test]
    async fn update_gym_renames_each_lifecycle_status_without_changing_it() {
        for status in ["new", "active", "inactive"] {
            let repository = FakeGymRepository {
                detail: None,
                update_status: status.to_owned(),
            };

            let gym = update_gym(
                &repository,
                "gym-id",
                "user-a",
                GymUpdate {
                    name: "  Renamed Gym  ".to_owned(),
                },
            )
            .await
            .expect("renames should be allowed for every gym status");

            assert_eq!(gym.name, "Renamed Gym");
            assert_eq!(gym.status, status);
        }
    }

    #[tokio::test]
    async fn delete_gym_allows_drafts_and_maps_protected_or_missing_gyms() {
        let repository = FakeGymRepository {
            detail: None,
            update_status: "new".to_owned(),
        };

        delete_gym(&repository, "new-gym", "user-a")
            .await
            .expect("draft gyms should be deletable");

        for gym_id in ["active-gym", "inactive-gym"] {
            assert!(matches!(
                delete_gym(&repository, gym_id, "user-a").await,
                Err(GymServiceError::Conflict(message)) if message == "Only draft gyms can be deleted"
            ));
        }

        assert!(matches!(
            delete_gym(&repository, "foreign-gym", "user-a").await,
            Err(GymServiceError::NotFound(message)) if message == "Gym not found"
        ));
    }
}
