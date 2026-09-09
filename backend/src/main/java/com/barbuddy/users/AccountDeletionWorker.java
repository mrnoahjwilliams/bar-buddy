package com.barbuddy.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(
    name = "bar-buddy.account-deletion.worker-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class AccountDeletionWorker {
  private static final Logger LOG = LoggerFactory.getLogger(AccountDeletionWorker.class);
  private final AccountDeletionService deletions;

  AccountDeletionWorker(AccountDeletionService deletions) {
    this.deletions = deletions;
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 60000)
  public void retryPending() {
    for (String subject : deletions.pending()) {
      try {
        deletions.finish(subject);
      } catch (RuntimeException exception) {
        // Never log provider responses, credentials or the user's identity.
        LOG.warn("Account identity deletion pending; retrying on the next pass");
      }
    }
  }
}
