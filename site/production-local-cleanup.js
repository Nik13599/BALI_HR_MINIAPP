(() => {
  const VERSION_KEY = "bali_production_local_cleanup_v3";
  if (localStorage.getItem(VERSION_KEY) === "1") return;
  const keys = [
    "bali_events_v2","bali_menu_v2","bali_tables_v2","bali_customers_v2","bali_bookings_v2",
    "bali_venue_content_v1","bali_reviews_v1","bali_points_accounts_v1","bali_bonus_profile_v1",
    "bali_bonus_ledger_v1","bali_bonus_actions_v1","bali_beta4_profile_v1","bali_beta4_achievements_v1",
    "bali_beta4_vip_v1","bali_beta4_vip_gifts_v1","bali_vip_config_v1",
    "bali_beta4_loyalty_config_v1","bali_beta4_chips_v1","bali_beta4_chip_history_v1",
    "bali_beta4_custom_rewards_v1","bali_beta4_reward_grants_v1","bali_app_users_v1",
    "bali_social_profile_v1","bali_social_people_v1","bali_social_requests_v1","bali_social_gifts_v1","bali_social_swipes_v2",
    "bali_event_checkins_v1","bali_event_rsvps_v1","bali_event_qr_trust_v2","bali_event_qr_registry_v1",
    "bali_chip_requests_v1","bali_event_checkin_notices_v1","bali_admin_messages_demo_v1",
    "bali_full_demo_seed_version_v1","bali_full_demo_active_user_v1","bali_full_demo_users_v1",
    "bali_event_content_demo_seed_v1","bali_demo_seed_version","bali_demo_live_sync_v1"
  ];
  keys.forEach(key => localStorage.removeItem(key));
  Object.keys(localStorage).filter(key => /demo|night_crown/i.test(key)).forEach(key => localStorage.removeItem(key));
  sessionStorage.removeItem("bali_app_user_registered");
  localStorage.setItem(VERSION_KEY, "1");
})();